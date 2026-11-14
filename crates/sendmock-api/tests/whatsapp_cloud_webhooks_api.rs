#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod recording_callback_sender;
    pub mod test_app;
}

use std::collections::BTreeMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use ring::hmac;
use sendmock_ops::{HttpCallResult, RecordedHttpRequest, RecordedHttpResponse, ReplyWebhookSender};
use serde_json::{Value, json};
use support::recording_callback_sender::RecordingCallbackSender;
use support::test_app::{build_test_app_with, call_api};

const CALLBACK_URL: &str = "http://127.0.0.1:9/whatsapp/webhook";
const APP_SECRET: &str = "whatsapp-app-secret";
const MESSAGES_PATH: &str = "/providers/whatsapp_cloud/v21.0/106540352242922/messages";

/// An app's webhook handler: records each request and answers `hub.challenge` back, as Meta's
/// check needs, or 200 with nothing.
#[derive(Default)]
struct EchoingWebhookApp {
    received_requests: Mutex<Vec<RecordedHttpRequest>>,
}

impl EchoingWebhookApp {
    fn received_requests(&self) -> Vec<RecordedHttpRequest> {
        self.received_requests
            .lock()
            .map(|requests| requests.clone())
            .unwrap_or_default()
    }
}

impl ReplyWebhookSender for EchoingWebhookApp {
    fn send_reply_webhook<'sender>(
        &'sender self,
        webhook_request: &'sender RecordedHttpRequest,
    ) -> Pin<Box<dyn Future<Output = HttpCallResult> + Send + 'sender>> {
        Box::pin(async move {
            if let Ok(mut received_requests) = self.received_requests.lock() {
                received_requests.push(webhook_request.clone());
            }
            let challenge = webhook_request
                .url
                .split_once('?')
                .map(|(_, query)| query)
                .unwrap_or_default()
                .split('&')
                .find_map(|query_pair| query_pair.strip_prefix("hub.challenge="))
                .unwrap_or_default()
                .to_owned();
            HttpCallResult {
                response: Some(RecordedHttpResponse {
                    status_code: 200,
                    headers: BTreeMap::new(),
                    body: challenge,
                    is_body_truncated: false,
                }),
                error_message: None,
                is_connection_failure: false,
                duration_ms: 2,
            }
        })
    }
}

/// SendMock with instant delivery, the Cloud provider's callback URL set, and both senders
/// recorded.
async fn build_cloud_app() -> (
    axum::Router,
    Arc<RecordingCallbackSender>,
    Arc<EchoingWebhookApp>,
) {
    let callback_sender = Arc::new(RecordingCallbackSender::default());
    let webhook_app = Arc::new(EchoingWebhookApp::default());
    let (callback_for_context, app_for_context) =
        (Arc::clone(&callback_sender), Arc::clone(&webhook_app));
    let (app_router, _) = build_test_app_with(move |operation_context| {
        operation_context
            .with_status_callback_sender(callback_for_context)
            .with_reply_webhook_sender(app_for_context)
    });
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "sms_simulation_profile": "instant" })),
    )
    .await;
    let provider_path = "/api/v1/sms/providers/whatsapp_cloud";
    let (_, mut cloud_provider) = call_api(&app_router, "GET", provider_path, None).await;
    for credential in cloud_provider["credentials"]
        .as_array_mut()
        .into_iter()
        .flatten()
    {
        if credential["name"] == "webhook_url" {
            credential["value"] = json!(CALLBACK_URL);
        }
    }
    let (status, updated) =
        call_api(&app_router, "PATCH", provider_path, Some(&cloud_provider)).await;
    assert_eq!(status, 200, "{updated}");
    (app_router, callback_sender, webhook_app)
}

fn sign_like_meta(body: &str) -> String {
    let signing_key = hmac::Key::new(hmac::HMAC_SHA256, APP_SECRET.as_bytes());
    let signature = hmac::sign(&signing_key, body.as_bytes());
    let hex_digest: String = signature
        .as_ref()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    format!("sha256={hex_digest}")
}

fn read_change_value(webhook_request: &RecordedHttpRequest) -> Value {
    let envelope: Value = serde_json::from_str(&webhook_request.body).unwrap_or(Value::Null);
    assert_eq!(
        envelope["object"], "whatsapp_business_account",
        "{}",
        webhook_request.body
    );
    envelope["entry"][0]["changes"][0]["value"].clone()
}

async fn send_text(app_router: &axum::Router, recipient: &str) {
    let message = json!({
        "messaging_product": "whatsapp", "to": recipient, "type": "text",
        "text": { "body": "Your order shipped" },
    });
    let (status, answer) = call_api(app_router, "POST", MESSAGES_PATH, Some(&message)).await;
    assert_eq!(status, 200, "{answer}");
}

// AC: SM-18.4
#[tokio::test]
async fn statuses_reach_the_callback_url_in_metas_signed_envelope() {
    let (app_router, callback_sender, _) = build_cloud_app().await;

    send_text(&app_router, "16505551234").await;
    let status_requests = callback_sender.wait_for_requests(2).await;

    let statuses: Vec<Value> = status_requests
        .iter()
        .map(|status_request| read_change_value(status_request)["statuses"][0]["status"].clone())
        .collect();
    assert_eq!(statuses, vec![json!("sent"), json!("delivered")]);
    let first_status = &status_requests[0];
    assert_eq!(first_status.url, CALLBACK_URL);
    assert_eq!(
        first_status.headers.get("X-Hub-Signature-256"),
        Some(&sign_like_meta(&first_status.body))
    );
    let status_value = read_change_value(first_status);
    assert_eq!(
        status_value["metadata"]["phone_number_id"],
        "106540352242922"
    );
    assert_eq!(status_value["statuses"][0]["recipient_id"], "16505551234");
}

// AC: SM-18.4
#[tokio::test]
async fn an_undelivered_message_reports_failed_with_131026() {
    let (app_router, callback_sender, _) = build_cloud_app().await;

    send_text(&app_router, "15005550101").await;
    let status_requests = callback_sender.wait_for_requests(2).await;

    let failed_status = status_requests
        .iter()
        .map(read_change_value)
        .find(|status_value| status_value["statuses"][0]["status"] == "failed")
        .unwrap_or(Value::Null);
    assert_eq!(
        failed_status["statuses"][0]["errors"][0]["code"], 131_026,
        "{failed_status}"
    );
    assert_eq!(
        failed_status["statuses"][0]["errors"][0]["title"],
        "Message undeliverable"
    );
}

// AC: SM-18.4
#[tokio::test]
async fn a_reply_in_a_cloud_conversation_reaches_the_callback_url_signed() {
    let (app_router, _, webhook_app) = build_cloud_app().await;
    let reply = json!({
        "from": "+16505551234", "to": "+15550783881",
        "body": "Where is my order?", "channel": "whatsapp",
    });

    call_api(&app_router, "POST", "/api/v1/sms/inbound", Some(&reply)).await;
    let mut reply_requests = webhook_app.received_requests();
    for _ in 0..40 {
        if !reply_requests.is_empty() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
        reply_requests = webhook_app.received_requests();
    }

    let reply_request = reply_requests
        .first()
        .cloned()
        .unwrap_or_else(|| panic!("no reply webhook"));
    let reply_value = read_change_value(&reply_request);
    assert_eq!(reply_request.url, CALLBACK_URL);
    assert_eq!(
        reply_request.headers.get("X-Hub-Signature-256"),
        Some(&sign_like_meta(&reply_request.body))
    );
    assert_eq!(reply_value["messages"][0]["from"], "16505551234");
    assert_eq!(
        reply_value["messages"][0]["text"]["body"],
        "Where is my order?"
    );
    assert_eq!(reply_value["contacts"][0]["wa_id"], "16505551234");
}

// AC: SM-18.4
#[tokio::test]
async fn the_callback_url_check_sends_metas_query_and_reports_the_echoed_challenge() {
    let (app_router, _, webhook_app) = build_cloud_app().await;

    let (status, verification) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms/whatsapp-cloud/verify-webhook",
        Some(&json!({})),
    )
    .await;

    assert_eq!(status, 200, "{verification}");
    assert_eq!(verification["is_verified"], true);
    let check_request = webhook_app
        .received_requests()
        .first()
        .cloned()
        .unwrap_or_else(|| panic!("no check"));
    assert_eq!(check_request.method, "GET");
    assert!(check_request.url.starts_with(&format!("{CALLBACK_URL}?hub.mode=subscribe&hub.verify_token=sendmock-verify-token&hub.challenge=")), "{}", check_request.url);
}
