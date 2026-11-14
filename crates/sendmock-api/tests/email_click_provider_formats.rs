#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod scripted_webhook_sender;
    pub mod test_app;
    pub mod webhook_samples;
}

use std::sync::Arc;
use std::time::Duration;

use sendmock_ops::{run_due_deliveries, run_webhook_rule_subscriber};
use serde_json::{Value, json};
use support::scripted_webhook_sender::ScriptedWebhookSender;
use support::test_app::{build_test_app_with, call_api};
use support::webhook_samples::{create_rule, endpoint_input};

const CLICK_EVENTS: &str = include_str!("fixtures/provider_webhooks/click_events.json");
const CLICKED_LINK: &str = "https://shop.test/verify?token=abc123";

/// An endpoint at its own URL that sends the template's format, and a rule on `email.clicked`.
async fn create_click_endpoint(app_router: &axum::Router, template_id: &str) {
    let mut endpoint = endpoint_input(template_id);
    endpoint["url"] = json!(format!("http://localhost:3000/{template_id}"));
    endpoint["template_id"] = json!(template_id);
    let (status, created) = call_api(
        app_router,
        "POST",
        "/api/v1/webhooks/endpoints",
        Some(&endpoint),
    )
    .await;
    assert_eq!(status, 201, "{created}");
    create_rule(
        app_router,
        &json!({
            "name": format!("{template_id} clicks"), "endpoint_id": created["id"],
            "events": ["email.clicked"], "is_enabled": true,
        }),
    )
    .await;
}

async fn add_secret_variable(app_router: &axum::Router, variable_name: &str, secret: &str) {
    let (status, created) = call_api(
        app_router,
        "POST",
        "/api/v1/webhooks/variables",
        Some(&json!({
            "name": variable_name, "kind": "secret", "scope": "global", "value": secret,
            "description": "",
        })),
    )
    .await;
    assert_eq!(status, 201, "{created}");
}

async fn send_and_click(app_router: &axum::Router) {
    let (status, sent) = call_api(
        app_router,
        "POST",
        "/api/v1/send",
        Some(&json!({
            "from": "no-reply@shop.test", "to": ["sam@example.test"], "subject": "Verify",
            "html": format!("<a href=\"{CLICKED_LINK}\">Verify</a>"),
        })),
    )
    .await;
    assert_eq!(status, 201, "{sent}");
    let email_id = sent["id"].as_str().unwrap_or_default();
    let (click_status, _) = call_api(
        app_router,
        "POST",
        &format!("/api/v1/emails/{email_id}/clicks"),
        Some(&json!({ "url": CLICKED_LINK, "user_agent": "Test agent" })),
    )
    .await;
    assert_eq!(click_status, 204);
}

/// The payload the fixture describes: the body, or the JSON string one of its fields holds.
fn read_payload(body: &str, template_fixture: &Value) -> Value {
    let body_value: Value = serde_json::from_str(body)
        .unwrap_or_else(|parse_error| panic!("a JSON body: {parse_error} in {body}"));
    match template_fixture["message_pointer"].as_str() {
        Some(message_pointer) => serde_json::from_str(
            body_value
                .pointer(message_pointer)
                .and_then(Value::as_str)
                .unwrap_or_default(),
        )
        .unwrap_or_else(|parse_error| panic!("a JSON message: {parse_error} in {body}")),
        None => body_value,
    }
}

// AC: EM-20.5
#[tokio::test]
async fn each_providers_template_sends_a_click_in_its_documented_shape() {
    let webhook_sender = Arc::new(ScriptedWebhookSender::default());
    let (app_router, operation_context) = build_test_app_with(|operation_context| {
        operation_context.with_webhook_sender(webhook_sender.clone())
    });
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(operation_context.clone()));
    tokio::task::yield_now().await;
    add_secret_variable(&app_router, "mailgun_signing_key", "key-sendmock-test").await;
    add_secret_variable(
        &app_router,
        "resend_signing_secret",
        "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
    )
    .await;
    let fixture: Value = serde_json::from_str(CLICK_EVENTS).unwrap_or_default();
    let templates = fixture["templates"]
        .as_object()
        .cloned()
        .unwrap_or_default();
    for template_id in templates.keys() {
        create_click_endpoint(&app_router, template_id).await;
    }

    send_and_click(&app_router).await;
    tokio::time::sleep(Duration::from_millis(200)).await;
    subscriber.abort();
    run_due_deliveries(&operation_context, 20)
        .await
        .unwrap_or_else(|error| panic!("the pass runs: {error}"));

    let sent_requests = webhook_sender.received_requests();
    for (template_id, template_fixture) in &templates {
        let sent_request = sent_requests
            .iter()
            .find(|sent_request| sent_request.url.ends_with(&format!("/{template_id}")))
            .unwrap_or_else(|| panic!("{template_id} sent nothing"));
        let payload = read_payload(&sent_request.body, template_fixture);
        let pointer_of =
            |field_name: &str| template_fixture[field_name].as_str().unwrap_or_default();
        assert_eq!(
            payload.pointer(pointer_of("event_pointer")),
            Some(&template_fixture["event_name"]),
            "{template_id}: {payload}"
        );
        assert_eq!(
            payload.pointer(pointer_of("link_pointer")),
            Some(&json!(CLICKED_LINK)),
            "{template_id}: {payload}"
        );
    }
}
