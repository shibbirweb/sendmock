#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod reply_webhook_fixture;
    pub mod scripted_twiml_app;
    pub mod test_app;
}

use serde_json::{Value, json};
use support::reply_webhook_fixture::{
    APP_NUMBER, CONTACT_NUMBER, INBOUND_URL, ReplyWebhookFixture, read_form_fields,
};
use support::scripted_twiml_app::{ScriptedTwimlApp, TwimlAppAnswer};
use support::test_app::call_api;

const FALLBACK_URL: &str = "http://fallback.test/sms/inbound";
const THANKS_TWIML: &str = "<Response><Message>Thanks!</Message></Response>";

fn app_answer(status_code: u16, content_type: &str, body: &str) -> TwimlAppAnswer {
    TwimlAppAnswer {
        status_code,
        content_type: content_type.to_owned(),
        body: body.to_owned(),
    }
}

async fn receive_and_wait(fixture: &ReplyWebhookFixture) -> Value {
    let inbound_sms = fixture.receive_text("YES").await;
    fixture.wait_for_reply_webhook(&inbound_sms["id"]).await
}

fn attempts(sms_detail: &Value) -> Vec<Value> {
    sms_detail["reply_webhook_attempts"]
        .as_array()
        .cloned()
        .unwrap_or_default()
}

// AC: SM-09.6
#[tokio::test]
async fn each_failure_carries_twilios_error_code_and_is_not_retried() {
    let failing_apps = [
        (
            "11200",
            ScriptedTwimlApp::default()
                .answering(INBOUND_URL, app_answer(500, "text/html", "oops")),
        ),
        ("11200", ScriptedTwimlApp::default().timing_out(INBOUND_URL)),
        ("11205", ScriptedTwimlApp::default().refusing(INBOUND_URL)),
        (
            "12100",
            ScriptedTwimlApp::default().answering(
                INBOUND_URL,
                app_answer(200, "text/xml", "<Reply>no</Reply>"),
            ),
        ),
        (
            "12300",
            ScriptedTwimlApp::default().answering(
                INBOUND_URL,
                app_answer(200, "application/json", "{\"reply\":\"hi\"}"),
            ),
        ),
    ];
    for (expected_code, twiml_app) in failing_apps {
        let fixture = ReplyWebhookFixture::new(twiml_app).await;
        fixture.create_number(json!({})).await;

        let sms_detail = receive_and_wait(&fixture).await;

        let reply_webhook = &sms_detail["reply_webhook"];
        assert_eq!(reply_webhook["outcome"], "failed", "{expected_code}");
        assert_eq!(reply_webhook["error_code"], expected_code);
        assert_eq!(reply_webhook["used_fallback"], false);
        assert_eq!(reply_webhook["reply_count"], 0);
        let stored_attempts = attempts(&sms_detail);
        assert_eq!(stored_attempts.len(), 1, "{expected_code}");
        assert_eq!(stored_attempts[0]["error_code"], expected_code);
        assert!(stored_attempts[0]["error_message"].is_string());
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        assert_eq!(
            fixture.twiml_app.received_requests().len(),
            1,
            "{expected_code}"
        );
    }
}

// AC: SM-09.6
#[tokio::test]
async fn the_fallback_gets_the_same_request_with_error_code_and_error_url() {
    let fixture = ReplyWebhookFixture::new(
        ScriptedTwimlApp::default()
            .refusing(INBOUND_URL)
            .answering_twiml(FALLBACK_URL, THANKS_TWIML),
    )
    .await;
    fixture
        .create_number(json!({ "inbound_fallback_url": FALLBACK_URL }))
        .await;

    let sms_detail = receive_and_wait(&fixture).await;

    let received_requests = fixture.twiml_app.wait_for_requests(2).await;
    assert_eq!(received_requests.len(), 2);
    assert_eq!(received_requests[1].url, FALLBACK_URL);
    let primary_fields = read_form_fields(&received_requests[0]);
    let mut fallback_fields = read_form_fields(&received_requests[1]);
    assert_eq!(
        fallback_fields.remove("ErrorCode").as_deref(),
        Some("11205")
    );
    assert_eq!(
        fallback_fields.remove("ErrorUrl").as_deref(),
        Some(INBOUND_URL)
    );
    assert_eq!(fallback_fields, primary_fields);
    let reply_webhook = &sms_detail["reply_webhook"];
    assert_eq!(reply_webhook["outcome"], "succeeded");
    assert_eq!(reply_webhook["error_code"], "11205");
    assert_eq!(reply_webhook["used_fallback"], true);
    assert_eq!(reply_webhook["status_code"], 200);
    assert_eq!(reply_webhook["reply_count"], 1);
    let stored_attempts = attempts(&sms_detail);
    assert_eq!(stored_attempts[0]["is_fallback"], false);
    assert!(stored_attempts[0]["response"].is_null());
    assert_eq!(stored_attempts[1]["is_fallback"], true);
    assert_eq!(
        fixture.wait_for_replies(&sms_detail["id"], 1).await.len(),
        1
    );
}

// AC: SM-09.6
#[tokio::test]
async fn a_failing_fallback_leaves_the_reply_webhook_failed() {
    let fixture = ReplyWebhookFixture::new(
        ScriptedTwimlApp::default()
            .answering(INBOUND_URL, app_answer(503, "text/plain", "down"))
            .answering(FALLBACK_URL, app_answer(500, "text/plain", "also down")),
    )
    .await;
    fixture
        .create_number(json!({ "inbound_fallback_url": FALLBACK_URL }))
        .await;

    let sms_detail = receive_and_wait(&fixture).await;

    let reply_webhook = &sms_detail["reply_webhook"];
    assert_eq!(reply_webhook["outcome"], "failed");
    assert_eq!(reply_webhook["error_code"], "11200");
    assert_eq!(reply_webhook["status_code"], 500);
    let (_, recent_events) = call_api(
        &fixture.app_router,
        "GET",
        "/api/v1/events/recent?type=sms.reply_webhook",
        None,
    )
    .await;
    assert_eq!(recent_events[0]["data"]["id"], sms_detail["id"]);
    assert_eq!(
        recent_events[0]["data"]["reply_webhook"]["outcome"],
        "failed"
    );
    assert_eq!(reply_webhook["used_fallback"], false);
    assert_eq!(attempts(&sms_detail).len(), 2);
}

// AC: SM-09.3
#[tokio::test]
async fn a_plain_text_answer_is_sent_back_as_the_reply() {
    let fixture = ReplyWebhookFixture::new(ScriptedTwimlApp::default().answering(
        INBOUND_URL,
        app_answer(200, "text/plain; charset=utf-8", "See you at 9"),
    ))
    .await;
    fixture.create_number(json!({})).await;

    let sms_detail = receive_and_wait(&fixture).await;

    assert_eq!(sms_detail["reply_webhook"]["outcome"], "succeeded");
    let replies = fixture.wait_for_replies(&sms_detail["id"], 1).await;
    assert_eq!(replies.len(), 1);
    assert_eq!(replies[0]["body"], "See you at 9");
    assert_eq!(replies[0]["to_number"], CONTACT_NUMBER);
    assert_eq!(replies[0]["from_number"], APP_NUMBER);
}

// AC: SM-09.7
#[tokio::test]
async fn the_detail_shows_each_request_with_its_response_and_parsed_twiml() {
    let fixture = ReplyWebhookFixture::new(
        ScriptedTwimlApp::default()
            .answering_twiml(
                INBOUND_URL,
                "<Response><Message to=\"+15550009999\" action=\"/sms/sent\" method=\"GET\">Hi</Message></Response>",
            )
            .answering_twiml(
                "http://app.test/sms/sent",
                "<Response><Redirect method=\"GET\">/sms/next</Redirect></Response>",
            ),
    )
    .await;
    fixture.create_number(json!({})).await;

    let sms_detail = receive_and_wait(&fixture).await;

    let stored_attempts = attempts(&sms_detail);
    assert_eq!(stored_attempts.len(), 3);
    let first_attempt = &stored_attempts[0];
    assert_eq!(first_attempt["request"]["url"], INBOUND_URL);
    assert!(first_attempt["request"]["headers"]["X-Twilio-Signature"].is_string());
    assert_eq!(first_attempt["response"]["status_code"], 200);
    assert_eq!(
        first_attempt["twiml"],
        json!([{
            "verb": "Message", "body": "Hi", "to": "+15550009999", "from": null,
            "status_callback": null, "action": "/sms/sent", "method": "GET", "media_urls": [],
        }])
    );
    assert_eq!(
        stored_attempts[1]["twiml"],
        json!([{ "verb": "Redirect", "url": "/sms/next", "method": "GET" }])
    );
    let redirect_url = stored_attempts[2]["request"]["url"]
        .as_str()
        .unwrap_or_default();
    assert!(redirect_url.starts_with("http://app.test/sms/next?SmsMessageSid="));
    assert_eq!(sms_detail["reply_webhook"]["reply_count"], 1);
    assert_eq!(sms_detail["reply_webhook"]["target"], "number");
}

// AC: SM-09.7
#[tokio::test]
async fn resend_sends_the_reply_webhook_again_once_the_handler_is_fixed() {
    let fixture = ReplyWebhookFixture::new(
        ScriptedTwimlApp::default().answering(INBOUND_URL, app_answer(500, "text/html", "oops")),
    )
    .await;
    fixture.create_number(json!({})).await;
    let failed_detail = receive_and_wait(&fixture).await;
    assert_eq!(failed_detail["reply_webhook"]["outcome"], "failed");

    fixture
        .twiml_app
        .answer_twiml_from_now_on(INBOUND_URL, THANKS_TWIML);
    let resend_path = format!(
        "/api/v1/sms/{}/reply-webhook/resend",
        failed_detail["id"].as_str().unwrap_or_default()
    );
    let (status, resent_detail) = call_api(&fixture.app_router, "POST", &resend_path, None).await;

    assert_eq!(status, 200, "{resent_detail}");
    assert_eq!(resent_detail["reply_webhook"]["outcome"], "succeeded");
    assert_eq!(resent_detail["reply_webhook"]["error_code"], Value::Null);
    assert_eq!(resent_detail["reply_webhook"]["reply_count"], 1);
    let stored_attempts = attempts(&resent_detail);
    assert_eq!(stored_attempts.len(), 2);
    assert_eq!(stored_attempts[0]["error_code"], "11200");
    assert_eq!(stored_attempts[1]["error_code"], Value::Null);
    assert_eq!(
        fixture
            .wait_for_replies(&resent_detail["id"], 1)
            .await
            .len(),
        1
    );
}

// AC: SM-09.7
#[tokio::test]
async fn resend_refuses_outbound_messages_and_numbers_without_a_reply_webhook() {
    let fixture = ReplyWebhookFixture::new(ScriptedTwimlApp::default()).await;
    let inbound_sms = fixture.receive_text("no number registered").await;
    let outbound_sms = fixture
        .post(
            "/api/v1/sms",
            &json!({ "from": APP_NUMBER, "to": CONTACT_NUMBER, "body": "Hello" }),
        )
        .await;
    let resend = |sms_id: &Value| {
        format!(
            "/api/v1/sms/{}/reply-webhook/resend",
            sms_id.as_str().unwrap_or_default()
        )
    };

    let (outbound_status, outbound_answer) = call_api(
        &fixture.app_router,
        "POST",
        &resend(&outbound_sms["id"]),
        None,
    )
    .await;
    let (unrouted_status, unrouted_answer) = call_api(
        &fixture.app_router,
        "POST",
        &resend(&inbound_sms["id"]),
        None,
    )
    .await;
    let (missing_status, _) = call_api(
        &fixture.app_router,
        "POST",
        &resend(&json!("01MISSING")),
        None,
    )
    .await;

    assert_eq!(outbound_status, 409);
    assert_eq!(outbound_answer["error"]["code"], "outbound_sms");
    assert_eq!(unrouted_status, 409);
    assert_eq!(unrouted_answer["error"]["code"], "no_reply_webhook");
    assert_eq!(missing_status, 404);
    assert!(fixture.twiml_app.received_requests().is_empty());
}
