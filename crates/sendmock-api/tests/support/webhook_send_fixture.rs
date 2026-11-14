use std::sync::Arc;

use sendmock_ops::{OperationContext, RecordedHttpRequest, run_due_deliveries};
use serde_json::{Value, json};

use super::manual_clock::ManualClock;
use super::scripted_webhook_sender::{ScriptedAnswer, ScriptedWebhookSender};
use super::test_app::{build_test_app_with, call_api};
use super::webhook_samples::endpoint_input;

/// An app whose webhook sender answers from a script, for sends made by hand.
pub struct WebhookSendFixture {
    pub app_router: axum::Router,
    pub operation_context: OperationContext,
    pub webhook_sender: Arc<ScriptedWebhookSender>,
}

pub fn build_send_fixture(scripted_answers: &[ScriptedAnswer]) -> WebhookSendFixture {
    let manual_clock = Arc::new(ManualClock::new(1_767_225_600_000));
    let webhook_sender = Arc::new(ScriptedWebhookSender::answering(scripted_answers));
    let (app_router, operation_context) = build_test_app_with(|mut operation_context| {
        operation_context.clock = manual_clock;
        operation_context.with_webhook_sender(webhook_sender.clone())
    });
    WebhookSendFixture {
        app_router,
        operation_context,
        webhook_sender,
    }
}

/// A global variable of `kind` with `value`.
pub fn global_variable(variable_name: &str, kind: &str, value: &str) -> Value {
    json!({
        "name": variable_name, "kind": kind, "scope": "global", "endpoint_id": null,
        "value": value, "random_mode": null, "description": "",
    })
}

impl WebhookSendFixture {
    /// Answers the status and body, without checking them.
    pub async fn post(&self, path: &str, request_body: &Value) -> (u16, Value) {
        call_api(&self.app_router, "POST", path, Some(request_body)).await
    }

    /// Creates an endpoint from the sheet's defaults with `changed_settings` over them.
    pub async fn create_endpoint(&self, changed_settings: Value) -> String {
        let mut endpoint_body = endpoint_input("Orders app");
        if let (Some(body_fields), Some(changed_entries)) =
            (endpoint_body.as_object_mut(), changed_settings.as_object())
        {
            body_fields.extend(changed_entries.clone());
        }
        let (status, created_endpoint) = self
            .post("/api/v1/webhooks/endpoints", &endpoint_body)
            .await;
        assert_eq!(status, 201, "{created_endpoint}");
        created_endpoint["id"]
            .as_str()
            .unwrap_or_default()
            .to_owned()
    }

    pub async fn create_variable(&self, variable_body: &Value) -> Value {
        let (status, created_variable) =
            self.post("/api/v1/webhooks/variables", variable_body).await;
        assert_eq!(status, 201, "{created_variable}");
        created_variable
    }

    /// Sends by hand and answers the queued delivery.
    pub async fn send_manually(&self, endpoint_id: &str, send_request: &Value) -> Value {
        let (status, manual_delivery) = self
            .post(
                &format!("/api/v1/webhooks/endpoints/{endpoint_id}/send"),
                send_request,
            )
            .await;
        assert_eq!(status, 201, "{manual_delivery}");
        manual_delivery
    }

    /// Replays a delivery and answers the queued replay.
    pub async fn replay(&self, delivery_id: &str, replay_request: &Value) -> Value {
        let (status, replayed_delivery) = self
            .post(
                &format!("/api/v1/webhooks/deliveries/{delivery_id}/replay"),
                replay_request,
            )
            .await;
        assert_eq!(status, 200, "{replayed_delivery}");
        replayed_delivery
    }

    pub async fn run_due(&self) -> usize {
        run_due_deliveries(&self.operation_context, 4)
            .await
            .unwrap_or_else(|error| panic!("the pass runs: {error}"))
    }

    /// The requests the sender received, oldest first.
    pub fn sent_requests(&self) -> Vec<RecordedHttpRequest> {
        self.webhook_sender.received_requests()
    }

    /// The body of the latest request the sender received.
    pub fn last_sent_body(&self) -> String {
        self.sent_requests()
            .last()
            .map(|sent_request| sent_request.body.clone())
            .unwrap_or_default()
    }
}
