#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod email_provider_requests;
    pub mod recording_callback_sender;
    pub mod test_app;
}

use std::sync::Arc;

use serde_json::{Value, json};
use support::email_provider_requests::send_json;
use support::recording_callback_sender::RecordingCallbackSender;
use support::test_app::{build_test_app_with, call_api};

const CALLBACK_URL: &str = "http://127.0.0.1:9/sms/reports";
const INFOBIP_SEND_PATH: &str = "/providers/infobip/sms/2/text/advanced";

/// A test app that records status callbacks, with SMS delivered at once.
async fn build_app_with_recorder() -> (axum::Router, Arc<RecordingCallbackSender>) {
    let callback_sender = Arc::new(RecordingCallbackSender::default());
    let sender_for_context = Arc::clone(&callback_sender);
    let (app_router, _) = build_test_app_with(move |operation_context| {
        operation_context.with_status_callback_sender(sender_for_context)
    });
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "sms_simulation_profile": "instant" })),
    )
    .await;
    (app_router, callback_sender)
}

async fn read_newest_sms(app_router: &axum::Router) -> Value {
    let (_, sms_list) = call_api(app_router, "GET", "/api/v1/sms", None).await;
    sms_list["items"][0].clone()
}

/// The body Infobip's Node SDK sends for one text message.
fn infobip_message(text: Option<&str>) -> Value {
    let mut message = json!({
        "destinations": [{ "to": "41793026727" }],
        "from": "InfoSMS",
        "notifyUrl": CALLBACK_URL,
        "notifyContentType": "application/json",
    });
    if let Some(text) = text {
        message["text"] = json!(text);
    }
    json!({ "messages": [message] })
}

// AC: SM-17.1
#[tokio::test]
async fn infobip_accepts_a_message_and_answers_its_pending_status() {
    let (app_router, _) = build_app_with_recorder().await;

    let sent = send_json(
        &app_router,
        INFOBIP_SEND_PATH,
        &infobip_message(Some("Your code is 482913")),
    )
    .await;

    assert_eq!(sent.status, 200, "{}", sent.body_text);
    assert!(sent.body["bulkId"].is_string(), "{}", sent.body_text);
    let answered_message = &sent.body["messages"][0];
    assert_eq!(answered_message["to"], "41793026727");
    assert_eq!(answered_message["status"]["groupName"], "PENDING");
    assert_eq!(answered_message["status"]["name"], "PENDING_ACCEPTED");
    let stored_sms = read_newest_sms(&app_router).await;
    assert_eq!(stored_sms["api"], "infobip");
    assert_eq!(stored_sms["body"], "Your code is 482913");
    assert_eq!(stored_sms["provider_id"], answered_message["messageId"]);
}

// AC: SM-17.1
#[tokio::test]
async fn infobip_refuses_a_message_without_text_in_its_error_shape() {
    let (app_router, _) = build_app_with_recorder().await;

    let refused = send_json(&app_router, INFOBIP_SEND_PATH, &infobip_message(None)).await;

    assert_eq!(refused.status, 400, "{}", refused.body_text);
    assert_eq!(
        refused.body["requestError"]["serviceException"]["messageId"],
        "BAD_REQUEST"
    );
    assert!(
        refused.body["requestError"]["serviceException"]["text"].is_string(),
        "{}",
        refused.body_text
    );
}

// AC: SM-17.1
#[tokio::test]
async fn infobip_reports_the_final_status_to_the_notify_url() {
    let (app_router, callback_sender) = build_app_with_recorder().await;

    let sent = send_json(
        &app_router,
        INFOBIP_SEND_PATH,
        &infobip_message(Some("Hello")),
    )
    .await;
    let reports = callback_sender.wait_for_requests(1).await;

    let delivery_report: Value = serde_json::from_str(&reports[0].body).unwrap_or(Value::Null);
    let report_result = &delivery_report["results"][0];
    assert_eq!(reports[0].url, CALLBACK_URL);
    assert_eq!(
        report_result["messageId"],
        sent.body["messages"][0]["messageId"]
    );
    assert_eq!(report_result["status"]["groupName"], "DELIVERED");
    assert_eq!(report_result["error"]["name"], "NO_ERROR");
}

const TELNYX_SEND_PATH: &str = "/providers/telnyx/v2/messages";

/// The body Telnyx's Node SDK sends for `client.messages.send`.
fn telnyx_message(text: Option<&str>) -> Value {
    let mut message = json!({
        "from": "+15550001111",
        "to": "+14155550100",
        "webhook_url": CALLBACK_URL,
    });
    if let Some(text) = text {
        message["text"] = json!(text);
    }
    message
}

// AC: SM-17.2
#[tokio::test]
async fn telnyx_queues_a_message_and_answers_its_message_object() {
    let (app_router, _) = build_app_with_recorder().await;

    let sent = send_json(
        &app_router,
        TELNYX_SEND_PATH,
        &telnyx_message(Some("Your code is 482913")),
    )
    .await;

    assert_eq!(sent.status, 200, "{}", sent.body_text);
    let message = &sent.body["data"];
    assert_eq!(message["record_type"], "message");
    assert_eq!(message["direction"], "outbound");
    assert_eq!(message["to"][0]["phone_number"], "+14155550100");
    assert_eq!(message["to"][0]["status"], "queued");
    assert_eq!(message["webhook_url"], CALLBACK_URL);
    let stored_sms = read_newest_sms(&app_router).await;
    assert_eq!(stored_sms["api"], "telnyx");
    assert_eq!(stored_sms["provider_id"], message["id"]);
}

// AC: SM-17.2
#[tokio::test]
async fn telnyx_refuses_a_message_without_text_in_its_errors_list() {
    let (app_router, _) = build_app_with_recorder().await;

    let refused = send_json(&app_router, TELNYX_SEND_PATH, &telnyx_message(None)).await;

    assert_eq!(refused.status, 422, "{}", refused.body_text);
    assert_eq!(refused.body["errors"][0]["code"], "10004");
    assert!(refused.body["errors"][0]["detail"].is_string());
}

// AC: SM-17.2
#[tokio::test]
async fn telnyx_sends_message_sent_then_message_finalized_to_the_webhook_url() {
    let (app_router, callback_sender) = build_app_with_recorder().await;

    send_json(
        &app_router,
        TELNYX_SEND_PATH,
        &telnyx_message(Some("Hello")),
    )
    .await;
    let webhooks = callback_sender.wait_for_requests(2).await;

    let events: Vec<Value> = webhooks
        .iter()
        .map(|webhook| serde_json::from_str(&webhook.body).unwrap_or(Value::Null))
        .collect();
    let event_types: Vec<&Value> = events
        .iter()
        .map(|event| &event["data"]["event_type"])
        .collect();
    assert_eq!(event_types, ["message.sent", "message.finalized"]);
    assert_eq!(events[1]["data"]["payload"]["to"][0]["status"], "delivered");
    assert_eq!(events[1]["data"]["payload"]["direction"], "outbound");
}

const SINCH_SEND_PATH: &str = "/providers/sinch/xms/v1/test-service-plan/batches";

/// The body Sinch's Node SDK sends for `sms.batches.send`.
fn sinch_batch(body: Option<&str>) -> Value {
    let mut batch = json!({
        "from": "+15550001111",
        "to": ["+14155550100"],
        "delivery_report": "per_recipient",
        "callback_url": CALLBACK_URL,
    });
    if let Some(body) = body {
        batch["body"] = json!(body);
    }
    batch
}

// AC: SM-17.3
#[tokio::test]
async fn sinch_creates_a_batch_and_answers_its_batch_object() {
    let (app_router, _) = build_app_with_recorder().await;

    let sent = send_json(
        &app_router,
        SINCH_SEND_PATH,
        &sinch_batch(Some("Your code is 482913")),
    )
    .await;

    assert_eq!(sent.status, 201, "{}", sent.body_text);
    assert_eq!(sent.body["type"], "mt_text");
    assert_eq!(sent.body["to"], json!(["+14155550100"]));
    assert_eq!(sent.body["canceled"], false);
    assert_eq!(sent.body["delivery_report"], "per_recipient");
    let stored_sms = read_newest_sms(&app_router).await;
    assert_eq!(stored_sms["api"], "sinch");
    assert_eq!(stored_sms["provider_id"], sent.body["id"]);
}

// AC: SM-17.3
#[tokio::test]
async fn sinch_refuses_a_batch_without_a_body_with_its_error_code() {
    let (app_router, _) = build_app_with_recorder().await;

    let refused = send_json(&app_router, SINCH_SEND_PATH, &sinch_batch(None)).await;

    assert_eq!(refused.status, 400, "{}", refused.body_text);
    assert_eq!(refused.body["code"], "syntax_constraint_violation");
    assert!(refused.body["text"].is_string());
}

// AC: SM-17.3
#[tokio::test]
async fn sinch_sends_recipient_delivery_reports_to_the_callback_url() {
    let (app_router, callback_sender) = build_app_with_recorder().await;

    let sent = send_json(&app_router, SINCH_SEND_PATH, &sinch_batch(Some("Hello"))).await;
    let reports = callback_sender.wait_for_requests(2).await;

    let report_statuses: Vec<Value> = reports
        .iter()
        .map(|report| serde_json::from_str::<Value>(&report.body).unwrap_or(Value::Null))
        .map(|report| report["status"].clone())
        .collect();
    assert_eq!(report_statuses, [json!("Dispatched"), json!("Delivered")]);
    let last_report: Value = serde_json::from_str(&reports[1].body).unwrap_or(Value::Null);
    assert_eq!(last_report["type"], "recipient_delivery_report_sms");
    assert_eq!(last_report["batch_id"], sent.body["id"]);
}
