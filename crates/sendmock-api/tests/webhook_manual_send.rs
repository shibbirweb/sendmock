#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod scripted_webhook_sender;
    pub mod test_app;
    pub mod webhook_samples;
    pub mod webhook_send_fixture;
}

use serde_json::{Value, json};
use support::scripted_webhook_sender::ScriptedAnswer;
use support::webhook_samples::send_email;
use support::webhook_send_fixture::{build_send_fixture, global_variable};

fn parse_body(body_text: &str) -> Value {
    serde_json::from_str(body_text).unwrap_or_else(|error| panic!("a JSON body: {error}"))
}

fn raw_body_settings(raw_body: &str) -> Value {
    json!({ "body_mode": "raw", "raw_content_type": "application/json", "raw_body": raw_body })
}

// AC: WH-01.2
#[tokio::test]
async fn send_test_delivers_test_ping_and_answers_with_the_response() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200)]);
    let endpoint_id = fixture.create_endpoint(json!({})).await;

    let (status, test_delivery) = fixture
        .post(
            &format!("/api/v1/webhooks/endpoints/{endpoint_id}/test"),
            &json!({}),
        )
        .await;

    assert_eq!(status, 200, "{test_delivery}");
    assert_eq!(test_delivery["event_type"], "test.ping");
    assert_eq!(test_delivery["trigger"], "manual");
    assert_eq!(test_delivery["status"], "succeeded");
    assert_eq!(test_delivery["response"]["status_code"], 200);
    let sent_headers = &test_delivery["request"]["headers"];
    assert!(
        sent_headers["webhook-signature"].is_string(),
        "{sent_headers}"
    );
    assert_eq!(sent_headers["webhook-id"], test_delivery["event_id"]);
    let sent_body = parse_body(
        test_delivery["request"]["body"]
            .as_str()
            .unwrap_or_default(),
    );
    assert_eq!(sent_body["type"], "test.ping");
    assert_eq!(sent_body["data"]["endpoint"], "Orders app");
    assert_eq!(fixture.sent_requests().len(), 1);
}

// AC: WH-01.2
#[tokio::test]
async fn a_failed_test_shows_the_error_and_is_not_retried() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(500)]);
    let endpoint_id = fixture.create_endpoint(json!({})).await;

    let (_, test_delivery) = fixture
        .post(
            &format!("/api/v1/webhooks/endpoints/{endpoint_id}/test"),
            &json!({}),
        )
        .await;
    let later_attempt_count = fixture.run_due().await;

    assert_eq!(test_delivery["status"], "exhausted");
    assert_eq!(test_delivery["response"]["status_code"], 500);
    assert_eq!(test_delivery["next_attempt_at"], Value::Null);
    assert_eq!(later_attempt_count, 0);
}

#[tokio::test]
async fn testing_or_sending_to_an_unknown_endpoint_is_not_found() {
    let fixture = build_send_fixture(&[]);

    let (test_status, _) = fixture
        .post("/api/v1/webhooks/endpoints/missing/test", &json!({}))
        .await;
    let (send_status, _) = fixture
        .post("/api/v1/webhooks/endpoints/missing/send", &json!({}))
        .await;

    assert_eq!((test_status, send_status), (404, 404));
}

// AC: WH-05.1
#[tokio::test]
async fn send_to_webhook_sends_an_email_with_the_chosen_template() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200)]);
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    let email_id = send_email(&fixture.app_router, "ann@example.com", "Order shipped").await;

    let manual_delivery = fixture
        .send_manually(
            &endpoint_id,
            &json!({ "email_id": email_id, "template_id": "slack.incoming_webhook" }),
        )
        .await;
    fixture.run_due().await;

    assert_eq!(manual_delivery["trigger"], "manual");
    assert_eq!(manual_delivery["status"], "pending");
    assert_eq!(manual_delivery["event_type"], "email.received");
    assert_eq!(manual_delivery["subject_id"], json!(email_id));
    assert_ne!(
        manual_delivery["event_id"],
        json!(format!("evt_{email_id}"))
    );
    let sent_body = parse_body(&fixture.last_sent_body());
    assert_eq!(sent_body["text"], "New email.received: Order shipped");
}

// AC: WH-05.1
#[tokio::test]
async fn each_manual_send_of_the_same_email_is_its_own_message() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200), ScriptedAnswer::Status(200)]);
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    let email_id = send_email(&fixture.app_router, "ann@example.com", "Hello").await;
    let send_request = json!({ "email_id": email_id });

    let first_delivery = fixture.send_manually(&endpoint_id, &send_request).await;
    let second_delivery = fixture.send_manually(&endpoint_id, &send_request).await;
    fixture.run_due().await;

    assert_ne!(first_delivery["event_id"], second_delivery["event_id"]);
    assert_eq!(fixture.sent_requests().len(), 2);
}

// AC: WH-05.3
#[tokio::test]
async fn the_composer_sends_a_hand_written_request() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200)]);
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    let mut written_request = support::webhook_samples::endpoint_input("Composer");
    written_request["url"] = json!("http://localhost:4000/composed");
    written_request["method"] = json!("PUT");
    if let (Some(request_fields), Some(raw_fields)) = (
        written_request.as_object_mut(),
        raw_body_settings(r#"{"subject": "{{ data.subject }}"}"#).as_object(),
    ) {
        request_fields.extend(raw_fields.clone());
    }

    fixture
        .send_manually(&endpoint_id, &json!({ "request": written_request }))
        .await;
    fixture.run_due().await;

    let sent_request = fixture.sent_requests().pop();
    let sent_request = sent_request.unwrap_or_else(|| panic!("the composer request was sent"));
    assert_eq!(sent_request.method, "PUT");
    assert_eq!(sent_request.url, "http://localhost:4000/composed");
    assert_eq!(
        parse_body(&sent_request.body)["subject"],
        "Your Acme sign-in code"
    );
}

#[tokio::test]
async fn an_invalid_hand_written_request_is_refused() {
    let fixture = build_send_fixture(&[]);
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    let mut written_request = support::webhook_samples::endpoint_input("Composer");
    written_request["url"] = json!("ftp://example.com");

    let (status, refusal) = fixture
        .post(
            &format!("/api/v1/webhooks/endpoints/{endpoint_id}/send"),
            &json!({ "request": written_request }),
        )
        .await;

    assert_eq!(status, 400, "{refusal}");
}

// AC: WH-05.4
#[tokio::test]
async fn send_time_variables_win_for_that_send_only() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200), ScriptedAnswer::Status(200)]);
    fixture
        .create_variable(&global_variable("greeting", "text", "hello"))
        .await;
    let endpoint_id = fixture
        .create_endpoint(raw_body_settings(r#"{"greeting": "{{ vars.greeting }}"}"#))
        .await;

    fixture
        .send_manually(
            &endpoint_id,
            &json!({ "variables": { "greeting": "hi there" } }),
        )
        .await;
    fixture.run_due().await;
    let overridden_body = parse_body(&fixture.last_sent_body());
    fixture.send_manually(&endpoint_id, &json!({})).await;
    fixture.run_due().await;
    let plain_body = parse_body(&fixture.last_sent_body());

    assert_eq!(overridden_body["greeting"], "hi there");
    assert_eq!(plain_body["greeting"], "hello");
}

// AC: WH-05.5
#[tokio::test]
async fn a_prompt_variable_takes_the_typed_answer_and_else_its_default() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200), ScriptedAnswer::Status(200)]);
    fixture
        .create_variable(&global_variable("reason", "prompt", "manual test"))
        .await;
    let endpoint_id = fixture
        .create_endpoint(raw_body_settings(r#"{"reason": "{{ vars.reason }}"}"#))
        .await;

    fixture
        .send_manually(
            &endpoint_id,
            &json!({ "variables": { "reason": "refund check" } }),
        )
        .await;
    fixture.run_due().await;
    let answered_body = parse_body(&fixture.last_sent_body());
    fixture.send_manually(&endpoint_id, &json!({})).await;
    fixture.run_due().await;
    let default_body = parse_body(&fixture.last_sent_body());

    assert_eq!(answered_body["reason"], "refund check");
    assert_eq!(default_body["reason"], "manual test");
}

// AC: WH-05.6
#[tokio::test]
async fn an_edited_body_is_sent_as_written_even_when_the_body_would_not_render() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200)]);
    let endpoint_id = fixture
        .create_endpoint(raw_body_settings(r#"{"value": "{{ vars.missing }}"}"#))
        .await;

    let manual_delivery = fixture
        .send_manually(&endpoint_id, &json!({ "body": "{\"edited\": true}" }))
        .await;
    fixture.run_due().await;

    assert_eq!(manual_delivery["status"], "pending");
    assert_eq!(fixture.last_sent_body(), "{\"edited\": true}");
}

// AC: WH-05.6
#[tokio::test]
async fn a_render_error_outside_the_body_blocks_the_send() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200)]);
    let endpoint_id = fixture
        .create_endpoint(json!({ "headers": { "X-Token": "{{ vars.missing }}" } }))
        .await;

    let manual_delivery = fixture
        .send_manually(&endpoint_id, &json!({ "body": "{}" }))
        .await;
    let attempt_count = fixture.run_due().await;

    assert_eq!(manual_delivery["status"], "render_failed");
    assert_eq!(manual_delivery["trigger"], "manual");
    let error_message = manual_delivery["error_message"]
        .as_str()
        .unwrap_or_default();
    assert!(error_message.contains("vars.missing"), "{error_message}");
    assert_eq!(attempt_count, 0);
    assert!(fixture.sent_requests().is_empty());
}
