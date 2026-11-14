use std::sync::Arc;

use sendmock_ops::{OperationContext, RecordedHttpRequest, run_due_deliveries};
use serde_json::{Value, json};

use super::manual_clock::ManualClock;
use super::scripted_webhook_sender::ScriptedWebhookSender;
use super::test_app::{build_test_app_with, call_api};

pub const START_UNIX_MS: i64 = 1_767_225_600_000;

pub struct NotificationFixture {
    pub app_router: axum::Router,
    pub operation_context: OperationContext,
    pub manual_clock: Arc<ManualClock>,
    pub webhook_sender: Arc<ScriptedWebhookSender>,
}

async fn create_shop_endpoint(app_router: &axum::Router) -> String {
    let (status, created_endpoint) = call_api(
        app_router,
        "POST",
        "/api/v1/webhooks/endpoints",
        Some(&json!({
            "name": "Shop payments", "url": "http://localhost:3000/payments/ipn", "method": "POST",
            "headers": {}, "extra_fields": {}, "template_id": "native",
            "template_mode": "linked", "timeout_ms": 10_000,
            "retry_policy": {
                "max_attempts": 3, "backoff_seconds": [1, 5],
                "retry_on_client_errors": false,
            },
            "is_enabled": true, "query_params": [], "body_mode": "template", "body_fields": [],
            "fields_encoding": "json", "raw_content_type": "application/json", "raw_body": "",
            "render_mode": "strict",
        })),
    )
    .await;
    assert_eq!(status, 201, "{created_endpoint}");
    created_endpoint["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

/// An app whose given gateways notify the "Shop payments" endpoint.
pub async fn build_fixture(
    webhook_sender: ScriptedWebhookSender,
    gateway_keys: &[&str],
) -> NotificationFixture {
    let manual_clock = Arc::new(ManualClock::new(START_UNIX_MS));
    let webhook_sender = Arc::new(webhook_sender);
    let (app_router, operation_context) = build_test_app_with(|mut operation_context| {
        operation_context.clock = manual_clock.clone();
        operation_context.with_webhook_sender(webhook_sender.clone())
    });
    let endpoint_id = create_shop_endpoint(&app_router).await;
    for gateway_key in gateway_keys {
        let gateway_path = format!("/api/v1/payments/gateways/{gateway_key}");
        let (_, mut payment_gateway) = call_api(&app_router, "GET", &gateway_path, None).await;
        payment_gateway["notification_endpoint_id"] = json!(endpoint_id);
        let (status, saved) =
            call_api(&app_router, "PATCH", &gateway_path, Some(&payment_gateway)).await;
        assert_eq!(status, 200, "{saved}");
    }
    NotificationFixture {
        app_router,
        operation_context,
        manual_clock,
        webhook_sender,
    }
}

impl NotificationFixture {
    pub async fn create_checkout(&self, provider: &str) -> String {
        let (status, payment) = call_api(
            &self.app_router,
            "POST",
            "/api/v1/payments/checkout",
            Some(&json!({ "provider": provider, "amount_minor": 1200, "currency": "USD" })),
        )
        .await;
        assert_eq!(status, 201, "{payment}");
        payment["id"].as_str().unwrap_or_default().to_owned()
    }

    pub async fn pay_with_test_card(&self, payment_id: &str) {
        let (status, session) = call_api(
            &self.app_router,
            "POST",
            &format!("/api/v1/checkout-sessions/{payment_id}/complete"),
            Some(&json!({
                "action": "pay", "method_key": "card",
                "card": { "number": "4242424242424242", "exp_month": 12, "exp_year": 2030 },
            })),
        )
        .await;
        assert_eq!(status, 200, "{session}");
    }

    pub async fn run_due(&self) {
        run_due_deliveries(&self.operation_context, 4)
            .await
            .unwrap_or_else(|error| panic!("the pass runs: {error}"));
    }

    pub async fn read_payment(&self, payment_id: &str) -> Value {
        call_api(
            &self.app_router,
            "GET",
            &format!("/api/v1/payments/{payment_id}"),
            None,
        )
        .await
        .1
    }

    pub fn sent_requests(&self) -> Vec<RecordedHttpRequest> {
        self.webhook_sender.received_requests()
    }
}

pub fn find_sent_body(
    sent_requests: &[RecordedHttpRequest],
    body_part: &str,
) -> RecordedHttpRequest {
    sent_requests
        .iter()
        .find(|sent_request| sent_request.body.contains(body_part))
        .cloned()
        .unwrap_or_else(|| panic!("a request with {body_part} in {sent_requests:?}"))
}
