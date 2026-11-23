#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod reply_webhook_fixture;
    pub mod scripted_twiml_app;
    pub mod test_app;
}

use sendmock_ops::sign_twilio_request;
use serde_json::{Value, json};
use support::reply_webhook_fixture::{
    APP_NUMBER, INBOUND_URL, ReplyWebhookFixture, TWILIO_AUTH_TOKEN, read_form_fields, read_header,
};
use support::scripted_twiml_app::ScriptedTwimlApp;
use support::test_app::call_api;

const SHOP_SUBACCOUNT_SID: &str = "AC22222222222222222222222222222222";
const LONDON_CONTACT: &str = "+447700900123";

/// Adds the Shop subaccount with a token SendMock generates and answers that token, read
/// back the way a user reveals it.
async fn add_shop_subaccount(fixture: &ReplyWebhookFixture) -> String {
    fixture
        .post(
            "/api/v1/twilio/subaccounts",
            &json!({
                "account_sid": SHOP_SUBACCOUNT_SID,
                "friendly_name": "Shop",
                "auth_token": null,
                "debugger_url": null,
            }),
        )
        .await;
    let (_, revealed) = call_api(
        &fixture.app_router,
        "GET",
        &format!("/api/v1/twilio/subaccounts/{SHOP_SUBACCOUNT_SID}/auth-token"),
        None,
    )
    .await;
    revealed["auth_token"]
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

/// A text from `from_number` to the app's number; answers the stored message and the fields
/// and signature of the reply webhook it sent.
async fn receive_text_from(
    fixture: &ReplyWebhookFixture,
    from_number: &str,
) -> (Value, Value, String) {
    let inbound_sms = fixture
        .post(
            "/api/v1/sms/inbound",
            &json!({ "from": from_number, "to": APP_NUMBER, "body": "Hello" }),
        )
        .await;
    let webhook_requests = fixture.twiml_app.wait_for_requests(1).await;
    let webhook_fields = Value::Object(
        read_form_fields(&webhook_requests[0])
            .into_iter()
            .map(|(field_name, field_value)| (field_name, Value::from(field_value)))
            .collect(),
    );
    let signature = read_header(&webhook_requests[0], "X-Twilio-Signature").to_owned();
    (inbound_sms, webhook_fields, signature)
}

// AC: SM-22.1
#[tokio::test]
async fn a_text_to_a_subaccounts_number_is_stored_named_and_signed_with_that_account() {
    let fixture = ReplyWebhookFixture::new(ScriptedTwimlApp::default()).await;
    let shop_auth_token = add_shop_subaccount(&fixture).await;
    fixture
        .create_number(json!({ "account_sid": SHOP_SUBACCOUNT_SID }))
        .await;

    let (inbound_sms, webhook_fields, signature) =
        receive_text_from(&fixture, LONDON_CONTACT).await;

    assert_eq!(inbound_sms["account"], SHOP_SUBACCOUNT_SID, "{inbound_sms}");
    assert_eq!(webhook_fields["AccountSid"], SHOP_SUBACCOUNT_SID);
    assert_eq!(
        signature,
        sign_twilio_request(INBOUND_URL, &webhook_fields, &shop_auth_token)
    );
    assert_ne!(
        signature,
        sign_twilio_request(INBOUND_URL, &webhook_fields, TWILIO_AUTH_TOKEN)
    );
}

// AC: SM-22.1
#[tokio::test]
async fn a_text_to_a_main_account_number_keeps_the_main_account() {
    let fixture = ReplyWebhookFixture::new(ScriptedTwimlApp::default()).await;
    add_shop_subaccount(&fixture).await;
    fixture.create_number(json!({})).await;

    let (inbound_sms, webhook_fields, signature) =
        receive_text_from(&fixture, LONDON_CONTACT).await;

    assert_eq!(inbound_sms["account"], Value::Null, "{inbound_sms}");
    assert_eq!(
        signature,
        sign_twilio_request(INBOUND_URL, &webhook_fields, TWILIO_AUTH_TOKEN)
    );
}

// AC: SM-22.2
#[tokio::test]
async fn the_inbound_webhook_sends_every_location_field_with_the_countries_of_the_numbers() {
    let fixture = ReplyWebhookFixture::new(ScriptedTwimlApp::default()).await;
    fixture.create_number(json!({})).await;

    let (_, webhook_fields, _) = receive_text_from(&fixture, LONDON_CONTACT).await;

    assert_eq!(webhook_fields["FromCountry"], "GB", "{webhook_fields}");
    assert_eq!(webhook_fields["ToCountry"], "US");
    for empty_field in [
        "FromCity",
        "FromState",
        "FromZip",
        "ToCity",
        "ToState",
        "ToZip",
    ] {
        assert_eq!(webhook_fields[empty_field], "", "{empty_field}");
    }
}
