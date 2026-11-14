#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod reply_webhook_fixture;
    pub mod scripted_twiml_app;
    pub mod test_app;
}

use sendmock_ops::{MAXIMUM_TWIML_FETCHES, sign_twilio_request};
use serde_json::{Value, json};
use support::reply_webhook_fixture::{
    APP_NUMBER, CONTACT_NUMBER, INBOUND_URL, ReplyWebhookFixture, TWILIO_AUTH_TOKEN,
    read_form_fields, read_header,
};
use support::scripted_twiml_app::{ScriptedTwimlApp, TwimlAppAnswer};

const NEXT_URL: &str = "http://app.test/sms/next";

fn text(value: &Value) -> &str {
    value.as_str().unwrap_or_default()
}

async fn build_fixture(twiml_app: ScriptedTwimlApp) -> ReplyWebhookFixture {
    let fixture = ReplyWebhookFixture::new(twiml_app).await;
    fixture.create_number(json!({})).await;
    fixture
}

// AC: SM-09.3
#[tokio::test]
async fn a_twiml_message_is_stored_as_a_reply_in_the_same_thread() {
    let fixture = build_fixture(ScriptedTwimlApp::default().answering_twiml(
        INBOUND_URL,
        r#"<?xml version="1.0" encoding="UTF-8"?>
        <Response><Message>Thanks, your booking is confirmed.</Message></Response>"#,
    ))
    .await;

    let inbound_sms = fixture.receive_text("Book me in").await;
    let replies = fixture.wait_for_replies(&inbound_sms["id"], 1).await;

    assert_eq!(replies.len(), 1);
    let reply = &replies[0];
    assert_eq!(reply["direction"], "outbound");
    assert_eq!(reply["api"], "twilio");
    assert_eq!(reply["body"], "Thanks, your booking is confirmed.");
    assert_eq!(reply["from_number"], APP_NUMBER);
    assert_eq!(reply["to_number"], CONTACT_NUMBER);
    assert_ne!(reply["status"], "failed");
    assert!(text(&reply["provider_id"]).starts_with("SM"));
    let (_, threads) =
        support::test_app::call_api(&fixture.app_router, "GET", "/api/v1/sms/threads", None).await;
    assert_eq!(threads.as_array().map(Vec::len), Some(1));
    assert_eq!(threads[0]["message_count"], 2);
}

// AC: SM-09.5
#[tokio::test]
async fn message_attributes_and_media_shape_each_reply_in_order() {
    let fixture = build_fixture(ScriptedTwimlApp::default().answering_twiml(
        INBOUND_URL,
        "<Response>\
           <Message to=\"+15550009999\" from=\"+15550008888\" statusCallback=\"/sms/status\">first</Message>\
           <Message><Body>second</Body><Media>https://cdn.test/ticket.png</Media></Message>\
         </Response>",
    ))
    .await;

    let inbound_sms = fixture.receive_text("hi").await;
    let replies = fixture.wait_for_replies(&inbound_sms["id"], 2).await;

    assert_eq!(replies.len(), 2);
    assert_eq!(replies[0]["body"], "first");
    assert_eq!(replies[0]["to_number"], "+15550009999");
    assert_eq!(replies[0]["from_number"], "+15550008888");
    assert_eq!(
        replies[0]["status_callback_url"],
        "http://app.test/sms/status"
    );
    assert_eq!(replies[1]["body"], "second");
    assert_eq!(replies[1]["to_number"], CONTACT_NUMBER);
    assert_eq!(
        replies[1]["media"][0]["source_url"],
        "https://cdn.test/ticket.png"
    );
    assert_eq!(replies[1]["media"][0]["content_type"], "image/png");
}

// AC: SM-09.5
#[tokio::test]
async fn a_redirect_fetches_new_twiml_and_skips_the_verbs_after_it() {
    let fixture = build_fixture(
        ScriptedTwimlApp::default()
            .answering_twiml(
                INBOUND_URL,
                "<Response><Redirect>/sms/next</Redirect><Message>never sent</Message></Response>",
            )
            .answering_twiml(
                NEXT_URL,
                "<Response><Message>from next</Message></Response>",
            ),
    )
    .await;

    let inbound_sms = fixture.receive_text("hi").await;
    let replies = fixture.wait_for_replies(&inbound_sms["id"], 1).await;
    let received_requests = fixture.twiml_app.received_requests();

    assert_eq!(received_requests.len(), 2);
    let redirect_request = &received_requests[1];
    assert_eq!(
        (
            redirect_request.method.as_str(),
            redirect_request.url.as_str()
        ),
        ("POST", NEXT_URL)
    );
    let redirect_fields = read_form_fields(redirect_request);
    assert_eq!(
        redirect_fields["MessageSid"],
        text(&inbound_sms["provider_id"])
    );
    assert_eq!(
        read_header(redirect_request, "X-Twilio-Signature"),
        sign_twilio_request(NEXT_URL, &json!(redirect_fields), TWILIO_AUTH_TOKEN)
    );
    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    let replies_after_wait = fixture.wait_for_replies(&inbound_sms["id"], 1).await;
    assert_eq!(replies.len(), 1);
    assert_eq!(replies_after_wait.len(), 1);
    assert_eq!(replies[0]["body"], "from next");
}

// AC: SM-09.5
#[tokio::test]
async fn an_action_gets_the_reply_status_and_its_twiml_replaces_the_rest() {
    let fixture = build_fixture(
        ScriptedTwimlApp::default()
            .answering_twiml(
                INBOUND_URL,
                "<Response><Message action=\"/sms/next\" method=\"GET\">first</Message>\
                 <Message>never sent</Message></Response>",
            )
            .answering_twiml(
                NEXT_URL,
                "<Response><Message>after the action</Message></Response>",
            ),
    )
    .await;

    let inbound_sms = fixture.receive_text("hi").await;
    let replies = fixture.wait_for_replies(&inbound_sms["id"], 2).await;
    let received_requests = fixture.twiml_app.received_requests();

    let bodies: Vec<&str> = replies.iter().map(|reply| text(&reply["body"])).collect();
    assert_eq!(bodies, ["first", "after the action"]);
    let action_request = &received_requests[1];
    assert_eq!(action_request.method, "GET");
    assert!(action_request.url.starts_with(&format!("{NEXT_URL}?")));
    let action_fields = read_form_fields(action_request);
    assert_eq!(action_fields["MessageStatus"], "sent");
    assert_eq!(
        action_fields["MessageSid"],
        text(&replies[0]["provider_id"])
    );
    assert_eq!(action_fields["From"], CONTACT_NUMBER);
}

// AC: SM-09.5
#[tokio::test]
async fn one_inbound_message_triggers_at_most_ten_twiml_fetches() {
    let fixture = build_fixture(ScriptedTwimlApp::default().answering_twiml(
        INBOUND_URL,
        "<Response><Message>again</Message><Redirect>/sms/inbound</Redirect></Response>",
    ))
    .await;

    let inbound_sms = fixture.receive_text("loop").await;
    let replies = fixture
        .wait_for_replies(&inbound_sms["id"], MAXIMUM_TWIML_FETCHES)
        .await;
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;

    assert_eq!(MAXIMUM_TWIML_FETCHES, 10);
    assert_eq!(fixture.twiml_app.received_requests().len(), 10);
    assert_eq!(replies.len(), 10);
}

// AC: SM-09.3
#[tokio::test]
async fn an_empty_response_or_a_failure_creates_no_reply() {
    let fixture = build_fixture(ScriptedTwimlApp::default().answering(
        INBOUND_URL,
        TwimlAppAnswer {
            status_code: 500,
            content_type: "text/xml".to_owned(),
            body: "<Response><Message>not read</Message></Response>".to_owned(),
        },
    ))
    .await;

    let inbound_sms = fixture.receive_text("hi").await;
    fixture.twiml_app.wait_for_requests(1).await;
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;

    assert!(
        fixture
            .wait_for_replies(&inbound_sms["id"], 0)
            .await
            .is_empty()
    );
}
