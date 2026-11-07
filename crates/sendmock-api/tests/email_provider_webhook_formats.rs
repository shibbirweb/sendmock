#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use std::collections::BTreeMap;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use ring::signature::{ECDSA_P256_SHA256_ASN1, UnparsedPublicKey};
use sendmock_webhooks::{
    SENDGRID_TEST_VERIFICATION_KEY, WebhookSecret, sign_mailgun_token, sign_payload,
};
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const SENDGRID_EVENT_WEBHOOK: &str =
    include_str!("fixtures/provider_webhooks/sendgrid_event_webhook.json");
const RESEND_WEBHOOK: &str = include_str!("fixtures/provider_webhooks/resend_webhook.json");
const MAILGUN_ROUTE_FORWARD: &str =
    include_str!("fixtures/provider_webhooks/mailgun_route_forward.json");
const RESEND_SIGNING_SECRET: &str = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";
const MAILGUN_SIGNING_KEY: &str = "key-sendmock-test";

/// The provider's documented example and the rendered body must both pass its schema.
fn check_against_fixture(fixture_json: &str, rendered_payload: &Value) {
    let fixture: Value = serde_json::from_str(fixture_json)
        .unwrap_or_else(|error| panic!("a readable fixture: {error}"));
    let validator = jsonschema::draft202012::new(&fixture["schema"])
        .unwrap_or_else(|error| panic!("the fixture schema compiles: {error}"));
    for payload in [&fixture["documented_example"], rendered_payload] {
        let schema_errors: Vec<String> = validator
            .iter_errors(payload)
            .map(|validation_error| validation_error.to_string())
            .collect();
        assert!(schema_errors.is_empty(), "{schema_errors:?} in {payload}");
    }
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

/// Renders a built-in template against the sample: its headers and body.
async fn render(
    app_router: &axum::Router,
    template_id: &str,
) -> (BTreeMap<String, String>, String) {
    let (status, rendered) = call_api(
        app_router,
        "POST",
        &format!("/api/v1/webhooks/templates/{template_id}/render"),
        Some(&json!({})),
    )
    .await;
    assert_eq!(status, 200, "{template_id}: {rendered}");
    assert_eq!(rendered["errors"], json!([]), "{template_id}: {rendered}");
    let headers = serde_json::from_value(rendered["headers"].clone()).unwrap_or_default();
    (
        headers,
        rendered["body"].as_str().unwrap_or_default().to_owned(),
    )
}

// AC: WH-06.1 WH-06.2
#[tokio::test]
async fn sendgrid_events_match_the_docs_and_verify_with_the_published_key() {
    let (app_router, _) = build_test_app();

    let (headers, body) = render(&app_router, "sendgrid.events").await;

    check_against_fixture(
        SENDGRID_EVENT_WEBHOOK,
        &serde_json::from_str(&body).unwrap_or(Value::Null),
    );
    let timestamp = headers
        .get("X-Twilio-Email-Event-Webhook-Timestamp")
        .cloned()
        .unwrap_or_default();
    let signature = STANDARD
        .decode(
            headers
                .get("X-Twilio-Email-Event-Webhook-Signature")
                .cloned()
                .unwrap_or_default(),
        )
        .unwrap_or_default();
    let public_key_info = STANDARD
        .decode(SENDGRID_TEST_VERIFICATION_KEY)
        .unwrap_or_default();
    let public_point = &public_key_info[public_key_info.len() - 65..];
    let verification = UnparsedPublicKey::new(&ECDSA_P256_SHA256_ASN1, public_point)
        .verify(format!("{timestamp}{body}").as_bytes(), &signature);
    assert!(verification.is_ok(), "{headers:?}");
}

// AC: WH-06.1 WH-06.2
#[tokio::test]
async fn resend_events_match_the_docs_and_carry_a_real_svix_signature() {
    let (app_router, _) = build_test_app();
    add_secret_variable(&app_router, "resend_signing_secret", RESEND_SIGNING_SECRET).await;

    let (headers, body) = render(&app_router, "resend.events").await;

    check_against_fixture(
        RESEND_WEBHOOK,
        &serde_json::from_str(&body).unwrap_or(Value::Null),
    );
    let svix_id = headers.get("svix-id").cloned().unwrap_or_default();
    let svix_timestamp: i64 = headers
        .get("svix-timestamp")
        .and_then(|timestamp| timestamp.parse().ok())
        .unwrap_or_default();
    let signing_secret = WebhookSecret::parse(RESEND_SIGNING_SECRET)
        .unwrap_or_else(|error| panic!("a valid secret: {error}"));
    assert_eq!(
        headers.get("svix-signature"),
        Some(&sign_payload(
            &signing_secret,
            &svix_id,
            svix_timestamp,
            &body
        ))
    );
}

// AC: WH-06.1 WH-06.2
#[tokio::test]
async fn mailgun_forwards_match_the_docs_with_a_real_signature() {
    let (app_router, _) = build_test_app();
    add_secret_variable(&app_router, "mailgun_signing_key", MAILGUN_SIGNING_KEY).await;

    let (_, body) = render(&app_router, "mailgun.routes").await;

    let form_fields: BTreeMap<String, String> =
        serde_urlencoded::from_str(&body).unwrap_or_default();
    check_against_fixture(MAILGUN_ROUTE_FORWARD, &json!(form_fields));
    assert_eq!(
        form_fields.get("signature"),
        Some(&sign_mailgun_token(
            MAILGUN_SIGNING_KEY,
            &form_fields["timestamp"],
            &form_fields["token"]
        ))
    );
}

const POSTMARK_WEBHOOK: &str = include_str!("fixtures/provider_webhooks/postmark_webhook.json");
const MAILGUN_EVENT_WEBHOOK: &str =
    include_str!("fixtures/provider_webhooks/mailgun_event_webhook.json");
const BREVO_WEBHOOK: &str = include_str!("fixtures/provider_webhooks/brevo_webhook.json");

// AC: WH-06.1
#[tokio::test]
async fn postmark_and_brevo_webhooks_match_their_docs() {
    let (app_router, _) = build_test_app();

    let (_, postmark_body) = render(&app_router, "postmark.webhooks").await;
    let (_, brevo_body) = render(&app_router, "brevo.events").await;

    check_against_fixture(
        POSTMARK_WEBHOOK,
        &serde_json::from_str(&postmark_body).unwrap_or(Value::Null),
    );
    check_against_fixture(
        BREVO_WEBHOOK,
        &serde_json::from_str(&brevo_body).unwrap_or(Value::Null),
    );
}

// AC: WH-06.1 WH-06.2
#[tokio::test]
async fn mailgun_event_webhooks_match_the_docs_with_a_real_signature() {
    let (app_router, _) = build_test_app();
    add_secret_variable(&app_router, "mailgun_signing_key", MAILGUN_SIGNING_KEY).await;

    let (_, body) = render(&app_router, "mailgun.events").await;

    let event_webhook: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
    check_against_fixture(MAILGUN_EVENT_WEBHOOK, &event_webhook);
    let signature = &event_webhook["signature"];
    assert_eq!(
        signature["signature"].as_str(),
        Some(
            sign_mailgun_token(
                MAILGUN_SIGNING_KEY,
                signature["timestamp"].as_str().unwrap_or_default(),
                signature["token"].as_str().unwrap_or_default()
            )
            .as_str()
        )
    );
}

const SES_SNS_NOTIFICATION: &str =
    include_str!("fixtures/provider_webhooks/ses_sns_notification.json");

// AC: WH-06.1
#[tokio::test]
async fn ses_notifications_arrive_in_snss_envelope_with_the_ses_message_inside() {
    let (app_router, _) = build_test_app();

    let (headers, body) = render(&app_router, "ses.sns").await;

    let notification: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
    check_against_fixture(SES_SNS_NOTIFICATION, &notification);
    let ses_message: Value =
        serde_json::from_str(notification["Message"].as_str().unwrap_or_default())
            .unwrap_or(Value::Null);
    assert!(
        ses_message["mail"]["destination"].is_array(),
        "{ses_message}"
    );
    assert_eq!(
        headers.get("x-amz-sns-message-type").map(String::as_str),
        Some("Notification")
    );
}

/// An email with a small text attachment, as an app sends it.
async fn send_email_with_attachment(app_router: &axum::Router) -> String {
    let (status, sent) = call_api(
        app_router,
        "POST",
        "/api/v1/send",
        Some(&json!({
            "from": "Sam <sam@example.test>", "to": ["support@inbound.app.test"],
            "subject": "Receipt attached", "text": "See the file",
            "attachments": [{ "filename": "receipt.txt", "content": "aGVsbG8=" }],
        })),
    )
    .await;
    assert_eq!(status, 201, "{sent}");
    sent["id"].as_str().unwrap_or_default().to_owned()
}

async fn render_for_email(
    app_router: &axum::Router,
    template_id: &str,
    email_id: &str,
) -> (BTreeMap<String, String>, String) {
    let (status, rendered) = call_api(
        app_router,
        "POST",
        &format!("/api/v1/webhooks/templates/{template_id}/render"),
        Some(&json!({ "email_id": email_id })),
    )
    .await;
    assert_eq!(status, 200, "{template_id}: {rendered}");
    assert_eq!(rendered["errors"], json!([]), "{template_id}: {rendered}");
    let headers = serde_json::from_value(rendered["headers"].clone()).unwrap_or_default();
    (
        headers,
        rendered["body"].as_str().unwrap_or_default().to_owned(),
    )
}

// AC: WH-06.3
#[tokio::test]
async fn postmark_inbound_carries_each_attachment_with_its_base64_content() {
    let (app_router, _) = build_test_app();
    let email_id = send_email_with_attachment(&app_router).await;

    let (_, body) = render_for_email(&app_router, "postmark.inbound", &email_id).await;

    let inbound: Value = serde_json::from_str(&body).unwrap_or(Value::Null);
    assert_eq!(inbound["TextBody"], "See the file", "{body}");
    assert_eq!(inbound["Attachments"][0]["Name"], "receipt.txt", "{body}");
    assert_eq!(inbound["Attachments"][0]["Content"], "aGVsbG8=");
    assert_eq!(inbound["Attachments"][0]["ContentLength"], 5);
}

// AC: WH-06.3
#[tokio::test]
async fn sendgrid_inbound_parse_posts_multipart_with_each_file_fetched_from_sendmock() {
    let (app_router, _) = build_test_app();
    let email_id = send_email_with_attachment(&app_router).await;

    let (headers, body) = render_for_email(&app_router, "sendgrid.inbound_parse", &email_id).await;

    assert!(
        headers
            .get("Content-Type")
            .or_else(|| headers.get("content-type"))
            .is_some_and(
                |content_type| content_type.starts_with("multipart/form-data; boundary=xYzZY")
            ),
        "{headers:?}"
    );
    assert!(body.contains("name=\"attachments\"\r\n\r\n1\r\n"), "{body}");
    assert!(
        body.contains(
            "name=\"attachment1\"; filename=\"receipt.txt\"\r\nX-Sendmock-File-Url: http://"
        ),
        "{body}"
    );
    assert!(
        body.contains(&format!("/api/v1/emails/{email_id}/attachments/0")),
        "{body}"
    );
    assert!(body.contains("name=\"text\"\r\n\r\nSee the file"), "{body}");
}
