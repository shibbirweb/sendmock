#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod scripted_webhook_sender;
    pub mod test_app;
    pub mod webhook_samples;
}

use std::sync::Arc;

use sendmock_ops::{
    AppEvent, DeliveryOrder, DeliveryTrigger, OperationContext, RecordedHttpRequest,
    enqueue_webhook_delivery, fire_matching_rules, run_due_deliveries,
};
use sendmock_store::WebhookDeliveryRecord;
use serde_json::{Value, json};
use support::manual_clock::ManualClock;
use support::scripted_webhook_sender::{ScriptedAnswer, ScriptedWebhookSender};
use support::test_app::{build_test_app_with, call_api};
use support::webhook_samples::{create_rule, endpoint_input, send_email};

struct RenderFixture {
    app_router: axum::Router,
    operation_context: OperationContext,
    manual_clock: Arc<ManualClock>,
    webhook_sender: Arc<ScriptedWebhookSender>,
}

fn build_fixture(scripted_answers: &[ScriptedAnswer]) -> RenderFixture {
    let manual_clock = Arc::new(ManualClock::new(1_767_225_600_000));
    let webhook_sender = Arc::new(ScriptedWebhookSender::answering(scripted_answers));
    let (app_router, operation_context) = build_test_app_with(|mut operation_context| {
        operation_context.clock = manual_clock.clone();
        operation_context.with_webhook_sender(webhook_sender.clone())
    });
    RenderFixture {
        app_router,
        operation_context,
        manual_clock,
        webhook_sender,
    }
}

fn email_event(event_id: &str) -> AppEvent {
    AppEvent {
        id: event_id.to_owned(),
        event_type: "email.received".to_owned(),
        created_at: "2026-01-01T00:00:00Z".to_owned(),
        data: json!({ "subject": "Welcome", "to": [{ "name": "Ann", "address": "ann@example.com" }] }),
    }
}

impl RenderFixture {
    async fn create_endpoint(&self, changed_settings: Value) -> String {
        let mut endpoint_body = endpoint_input("Orders app");
        if let (Some(body_fields), Some(changed_entries)) =
            (endpoint_body.as_object_mut(), changed_settings.as_object())
        {
            body_fields.extend(changed_entries.clone());
        }
        let (status, created_endpoint) = call_api(
            &self.app_router,
            "POST",
            "/api/v1/webhooks/endpoints",
            Some(&endpoint_body),
        )
        .await;
        assert_eq!(status, 201, "{created_endpoint}");
        created_endpoint["id"]
            .as_str()
            .unwrap_or_default()
            .to_owned()
    }

    async fn create_variable(&self, variable_body: Value) -> Value {
        let (status, created_variable) = call_api(
            &self.app_router,
            "POST",
            "/api/v1/webhooks/variables",
            Some(&variable_body),
        )
        .await;
        assert_eq!(status, 201, "{created_variable}");
        created_variable
    }

    async fn queue_delivery(
        &self,
        endpoint_id: &str,
        app_event: AppEvent,
    ) -> WebhookDeliveryRecord {
        let stored_endpoint = self
            .operation_context
            .webhook_endpoint_repository
            .find_endpoint(endpoint_id)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| panic!("the endpoint {endpoint_id} exists"));
        let delivery_order = DeliveryOrder {
            app_event,
            subject_id: None,
            rule_id: None,
            delivery_trigger: DeliveryTrigger::Automatic,
            send_time_values: serde_json::Map::new(),
        };
        enqueue_webhook_delivery(&self.operation_context, &stored_endpoint, delivery_order)
            .await
            .unwrap_or_else(|error| panic!("the delivery is queued: {error}"))
    }

    async fn run_due(&self) -> usize {
        run_due_deliveries(&self.operation_context, 2)
            .await
            .unwrap_or_else(|error| panic!("the pass runs: {error}"))
    }
}

fn read_rendered_request(queued_delivery: &WebhookDeliveryRecord) -> RecordedHttpRequest {
    queued_delivery
        .rendered_request_json
        .as_deref()
        .and_then(|request_json| serde_json::from_str(request_json).ok())
        .unwrap_or_else(|| panic!("the delivery has a rendered request"))
}

fn header_value(request: &RecordedHttpRequest, header_name: &str) -> String {
    request
        .headers
        .get(header_name)
        .cloned()
        .unwrap_or_default()
}

// AC: WH-07.5
#[tokio::test]
async fn strict_mode_stores_render_failed_and_never_sends_it() {
    let fixture = build_fixture(&[ScriptedAnswer::Status(200)]);
    let endpoint_id = fixture
        .create_endpoint(json!({ "headers": { "X-Missing": "{{ vars.missing }}" } }))
        .await;

    let failed_delivery = fixture
        .queue_delivery(&endpoint_id, email_event("evt_1"))
        .await;
    let attempt_count = fixture.run_due().await;

    assert_eq!(failed_delivery.status, "render_failed");
    assert!(failed_delivery.rendered_request_json.is_none());
    assert_eq!(failed_delivery.next_attempt_at_unix_ms, None);
    let error_message = failed_delivery.error_message.unwrap_or_default();
    assert!(error_message.starts_with("header.0: "), "{error_message}");
    assert!(error_message.contains("vars.missing"), "{error_message}");
    assert_eq!(attempt_count, 0);
    assert!(fixture.webhook_sender.received_requests().is_empty());
}

// AC: WH-07.5
#[tokio::test]
async fn lenient_mode_sends_an_undefined_value_as_empty() {
    let fixture = build_fixture(&[ScriptedAnswer::Status(200)]);
    let endpoint_id = fixture
        .create_endpoint(json!({
            "headers": { "X-Missing": "{{ vars.missing }}" }, "render_mode": "lenient",
        }))
        .await;

    let queued_delivery = fixture
        .queue_delivery(&endpoint_id, email_event("evt_1"))
        .await;
    fixture.run_due().await;

    assert_eq!(queued_delivery.status, "pending");
    assert_eq!(
        header_value(&read_rendered_request(&queued_delivery), "x-missing"),
        ""
    );
    assert_eq!(fixture.webhook_sender.received_requests().len(), 1);
}

// AC: WH-07.4
#[tokio::test]
async fn a_per_send_random_value_stays_across_retries_and_changes_on_the_next_send() {
    let fixture = build_fixture(&[
        ScriptedAnswer::Status(500),
        ScriptedAnswer::Status(200),
        ScriptedAnswer::Status(200),
    ]);
    let variable_input = |variable_name: &str, random_mode: &str| {
        json!({
            "name": variable_name, "kind": "random", "scope": "global", "endpoint_id": null,
            "value": "random_string(12)", "random_mode": random_mode, "description": "",
        })
    };
    fixture
        .create_variable(variable_input("nonce", "per_send"))
        .await;
    let fixed_variable = fixture
        .create_variable(variable_input("fixed_key", "fixed"))
        .await;
    let endpoint_id = fixture
        .create_endpoint(json!({
            "headers": { "X-Nonce": "{{ vars.nonce }}", "X-Fixed": "{{ vars.fixed_key }}" },
            "retry_policy": { "max_attempts": 2, "backoff_seconds": [1], "retry_on_client_errors": false },
        }))
        .await;

    fixture
        .queue_delivery(&endpoint_id, email_event("evt_1"))
        .await;
    fixture.run_due().await;
    fixture.manual_clock.advance_ms(1_000);
    fixture.run_due().await;
    fixture
        .queue_delivery(&endpoint_id, email_event("evt_2"))
        .await;
    fixture.run_due().await;

    let sent_requests = fixture.webhook_sender.received_requests();
    let nonces: Vec<String> = sent_requests
        .iter()
        .map(|sent_request| header_value(sent_request, "x-nonce"))
        .collect();
    assert_eq!(nonces.len(), 3);
    assert_eq!(nonces[0].len(), 12);
    assert_eq!(nonces[0], nonces[1]);
    assert_ne!(nonces[0], nonces[2]);
    for sent_request in &sent_requests {
        assert_eq!(
            header_value(sent_request, "x-fixed"),
            fixed_variable["fixed_value"]
        );
    }
}

/// Raw text with every built-in context name a template can read.
fn context_body() -> Value {
    json!({
        "body_mode": "raw",
        "raw_content_type": "text/plain",
        "raw_body": "{{ endpoint.name }}|{{ delivery.trigger }}|{{ delivery.attempt }}|{{ rule.name }}|{{ sendmock.version }}|{{ request_id | length }}|{{ email.subject }}",
    })
}

async fn receive_email_event(
    event_receiver: &mut tokio::sync::broadcast::Receiver<sendmock_ops::RecordedEvent>,
) -> AppEvent {
    loop {
        let recorded_event = event_receiver
            .recv()
            .await
            .unwrap_or_else(|error| panic!("an event arrives: {error}"));
        if recorded_event.app_event.event_type == "email.received" {
            return recorded_event.app_event;
        }
    }
}

// AC: WH-07.1
#[tokio::test]
async fn a_rule_delivery_reads_the_endpoint_delivery_rule_and_instance() {
    let fixture = build_fixture(&[]);
    let endpoint_id = fixture.create_endpoint(context_body()).await;
    create_rule(
        &fixture.app_router,
        &json!({
            "name": "Support mail", "endpoint_id": endpoint_id, "events": ["email.received"],
            "filter": null, "is_enabled": true,
        }),
    )
    .await;
    let mut event_receiver = fixture.operation_context.event_bus.subscribe();
    send_email(&fixture.app_router, "ann@example.com", "Welcome").await;
    let app_event = receive_email_event(&mut event_receiver).await;

    fire_matching_rules(&fixture.operation_context, &app_event)
        .await
        .unwrap_or_else(|error| panic!("the rules fire: {error}"));

    let queued_deliveries = fixture
        .operation_context
        .webhook_delivery_repository
        .list_due_deliveries(i64::MAX, 10)
        .await
        .unwrap_or_default();
    let version = fixture.operation_context.instance_details.version;
    assert_eq!(
        read_rendered_request(&queued_deliveries[0]).body,
        format!("Orders app|auto|1|Support mail|{version}|26|Welcome")
    );
}

// AC: WH-07.8
#[tokio::test]
async fn the_preview_matches_the_request_a_delivery_sends() {
    let fixture = build_fixture(&[]);
    let endpoint_id = fixture
        .create_endpoint(json!({
            "url": "http://localhost:3000/hooks/{{ data.to[0].address }}",
            "query_params": [{ "name": "subject", "value": "{{ data.subject }}" }],
            "headers": { "X-Event": "{{ event.type }}" },
            "body_mode": "fields",
            "body_fields": [{ "name": "subject", "value_type": "text", "value": "{{ email.subject | upper }}" }],
        }))
        .await;
    let mut event_receiver = fixture.operation_context.event_bus.subscribe();
    let email_id = send_email(&fixture.app_router, "ann@example.com", "Order shipped").await;
    let app_event = receive_email_event(&mut event_receiver).await;

    let queued_delivery = fixture.queue_delivery(&endpoint_id, app_event).await;
    let (_, preview_result) = call_api(
        &fixture.app_router,
        "POST",
        "/api/v1/webhooks/endpoints/preview",
        Some(&json!({ "endpoint_id": endpoint_id, "email_id": email_id })),
    )
    .await;

    let sent_request = read_rendered_request(&queued_delivery);
    assert_eq!(preview_result["url"], sent_request.url);
    assert_eq!(preview_result["headers"], json!(sent_request.headers));
    assert_eq!(preview_result["body"], sent_request.body);
    assert_eq!(preview_result["body"], "{\"subject\":\"ORDER SHIPPED\"}");
}
