#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod reply_webhook_fixture;
    pub mod scripted_twiml_app;
    pub mod test_app;
}

use sendmock_ops::sign_twilio_request;
use serde_json::{Value, json};
use support::reply_webhook_fixture::{
    APP_NUMBER, CONTACT_NUMBER, INBOUND_URL, ReplyWebhookFixture, TWILIO_AUTH_TOKEN,
    read_form_fields, read_header,
};
use support::scripted_twiml_app::ScriptedTwimlApp;

const SERVICE_URL: &str = "http://app.test/service/inbound";

fn text(value: &Value) -> &str {
    value.as_str().unwrap_or_default()
}

async fn create_service(
    fixture: &ReplyWebhookFixture,
    number: &Value,
    inbound_mode: &str,
) -> Value {
    fixture
        .post(
            "/api/v1/messaging-services",
            &json!({
                "friendly_name": "Support",
                "number_ids": [number["id"]],
                "inbound_mode": inbound_mode,
                "inbound_url": SERVICE_URL,
                "inbound_fallback_url": null,
            }),
        )
        .await
}

// AC: SM-09.2, SM-09.4
#[tokio::test]
async fn the_numbers_inbound_url_gets_twilios_fields_and_signed_headers() {
    let fixture = ReplyWebhookFixture::new(ScriptedTwimlApp::default()).await;
    fixture.create_number(json!({})).await;

    let inbound_sms = fixture.receive_text("Is my order ready?").await;
    let received_requests = fixture.twiml_app.wait_for_requests(1).await;

    assert_eq!(received_requests.len(), 1);
    let webhook_request = &received_requests[0];
    let form_fields = read_form_fields(webhook_request);
    let message_sid = text(&inbound_sms["provider_id"]);
    assert!(
        message_sid.starts_with("SM") && message_sid.len() == 34,
        "{message_sid}"
    );
    assert_eq!(
        (
            webhook_request.method.as_str(),
            webhook_request.url.as_str()
        ),
        ("POST", INBOUND_URL)
    );
    for sid_field in ["MessageSid", "SmsSid", "SmsMessageSid"] {
        assert_eq!(form_fields[sid_field], message_sid);
    }
    assert_eq!(form_fields["From"], CONTACT_NUMBER);
    assert_eq!(form_fields["To"], APP_NUMBER);
    assert_eq!(form_fields["Body"], "Is my order ready?");
    assert_eq!(form_fields["NumMedia"], "0");
    assert_eq!(form_fields["NumSegments"], "1");
    assert_eq!(form_fields["SmsStatus"], "received");
    assert_eq!(form_fields["ApiVersion"], "2010-04-01");
    assert!(form_fields["AccountSid"].starts_with("AC"));
    assert!(!form_fields.contains_key("MessagingServiceSid"));
    assert_eq!(
        read_header(webhook_request, "Content-Type"),
        "application/x-www-form-urlencoded"
    );
    assert_eq!(
        read_header(webhook_request, "User-Agent"),
        "TwilioProxy/1.1"
    );
    assert!(!read_header(webhook_request, "I-Twilio-Idempotency-Token").is_empty());
    assert_eq!(
        read_header(webhook_request, "X-Twilio-Signature"),
        sign_twilio_request(INBOUND_URL, &json!(form_fields), TWILIO_AUTH_TOKEN)
    );
}

// AC: SM-09.4
#[tokio::test]
async fn a_get_webhook_sends_the_fields_in_the_query_and_signs_the_full_url() {
    let fixture = ReplyWebhookFixture::new(ScriptedTwimlApp::default()).await;
    fixture
        .create_number(json!({ "inbound_method": "GET" }))
        .await;

    fixture.receive_text("hello").await;
    let received_requests = fixture.twiml_app.wait_for_requests(1).await;

    let webhook_request = &received_requests[0];
    assert_eq!(webhook_request.method, "GET");
    assert!(webhook_request.url.starts_with(&format!("{INBOUND_URL}?")));
    assert_eq!(webhook_request.body, "");
    assert_eq!(read_form_fields(webhook_request)["Body"], "hello");
    assert_eq!(
        read_header(webhook_request, "X-Twilio-Signature"),
        sign_twilio_request(&webhook_request.url, &json!({}), TWILIO_AUTH_TOKEN)
    );
}

// AC: SM-09.4
#[tokio::test]
async fn a_messaging_service_set_to_send_a_webhook_gets_the_message_instead_of_the_number() {
    let fixture = ReplyWebhookFixture::new(ScriptedTwimlApp::default()).await;
    let number = fixture
        .create_number(json!({ "inbound_method": "GET" }))
        .await;
    let service = create_service(&fixture, &number, "webhook").await;

    fixture.receive_text("hi").await;
    let received_requests = fixture.twiml_app.wait_for_requests(1).await;

    assert_eq!(received_requests.len(), 1);
    assert_eq!(received_requests[0].method, "POST");
    assert_eq!(received_requests[0].url, SERVICE_URL);
    assert_eq!(
        read_form_fields(&received_requests[0])["MessagingServiceSid"],
        text(&service["sid"])
    );
}

// AC: SM-09.4
#[tokio::test]
async fn a_service_that_defers_uses_the_numbers_url_and_one_that_drops_sends_nothing() {
    let deferring = ReplyWebhookFixture::new(ScriptedTwimlApp::default()).await;
    let deferring_number = deferring.create_number(json!({})).await;
    let service = create_service(&deferring, &deferring_number, "defer_to_sender").await;
    let dropping = ReplyWebhookFixture::new(ScriptedTwimlApp::default()).await;
    let dropping_number = dropping.create_number(json!({})).await;
    create_service(&dropping, &dropping_number, "drop").await;

    deferring.receive_text("hi").await;
    dropping.receive_text("hi").await;
    let deferred_requests = deferring.twiml_app.wait_for_requests(1).await;
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;

    assert_eq!(deferred_requests[0].url, INBOUND_URL);
    assert_eq!(
        read_form_fields(&deferred_requests[0])["MessagingServiceSid"],
        text(&service["sid"])
    );
    assert!(dropping.twiml_app.received_requests().is_empty());
}

// AC: SM-09.4
#[tokio::test]
async fn media_and_whatsapp_messages_carry_twilios_media_and_whatsapp_fields() {
    let fixture = ReplyWebhookFixture::new(ScriptedTwimlApp::default()).await;
    fixture.create_number(json!({})).await;
    let photo =
        json!({ "filename": "photo.png", "content": "iVBORw0K", "content_type": "image/png" });

    let inbound_sms = fixture
        .post(
            "/api/v1/sms/inbound",
            &json!({ "from": CONTACT_NUMBER, "to": APP_NUMBER, "body": "look", "channel": "whatsapp", "media": [photo] }),
        )
        .await;
    let received_requests = fixture.twiml_app.wait_for_requests(1).await;

    let form_fields = read_form_fields(&received_requests[0]);
    assert_eq!(form_fields["NumMedia"], "1");
    assert_eq!(form_fields["MediaContentType0"], "image/png");
    assert_eq!(
        form_fields["MediaUrl0"],
        format!(
            "http://127.0.0.1:8025/api/v1/sms/{}/media/0",
            text(&inbound_sms["id"])
        )
    );
    assert_eq!(form_fields["From"], format!("whatsapp:{CONTACT_NUMBER}"));
    assert_eq!(form_fields["To"], format!("whatsapp:{APP_NUMBER}"));
    assert_eq!(form_fields["WaId"], CONTACT_NUMBER.trim_start_matches('+'));
    assert!(form_fields.contains_key("ProfileName"));
}

// AC: SM-09.2
#[tokio::test]
async fn the_number_can_choose_another_providers_inbound_format() {
    let fixture = ReplyWebhookFixture::new(ScriptedTwimlApp::default()).await;
    fixture
        .create_number(json!({ "inbound_template_id": "vonage.inbound" }))
        .await;

    fixture.receive_text("hello").await;
    let received_requests = fixture.twiml_app.wait_for_requests(1).await;

    let inbound_message: Value = serde_json::from_str(&received_requests[0].body)
        .unwrap_or_else(|error| panic!("a JSON body: {error}"));
    assert_eq!(
        inbound_message["msisdn"],
        CONTACT_NUMBER.trim_start_matches('+')
    );
    assert_eq!(inbound_message["to"], APP_NUMBER.trim_start_matches('+'));
    assert_eq!(inbound_message["text"], "hello");
}

// AC: SM-09.4
#[tokio::test]
async fn a_number_without_an_inbound_url_sends_no_reply_webhook() {
    let fixture = ReplyWebhookFixture::new(ScriptedTwimlApp::default()).await;
    fixture.create_number(json!({ "inbound_url": null })).await;

    let inbound_sms = fixture.receive_text("hi").await;
    tokio::time::sleep(std::time::Duration::from_millis(200)).await;

    assert!(fixture.twiml_app.received_requests().is_empty());
    assert_eq!(inbound_sms["direction"], "inbound");
}
