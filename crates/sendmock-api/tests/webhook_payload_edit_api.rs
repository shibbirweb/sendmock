#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod scripted_webhook_sender;
    pub mod test_app;
    pub mod webhook_samples;
    pub mod webhook_send_fixture;
}

use std::time::Duration;

use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64;
use ring::hmac;
use sendmock_ops::{RecordedHttpRequest, run_webhook_rule_subscriber};
use serde_json::{Value, json};
use support::scripted_webhook_sender::ScriptedAnswer;
use support::test_app::call_api;
use support::webhook_samples::{create_rule, send_email};
use support::webhook_send_fixture::{WebhookSendFixture, build_send_fixture};

const MATCH_PATH: &str = "/api/v1/webhooks/rules/match";
const EDITED_BODY: &str = "{\"order\":\"A-1\",  \"note\":\"typed by hand\"}\n";
const RAZORPAY_SECRET: &str = "shop-razorpay-secret";

/// A fixture whose rule subscriber runs, so simulations queue their webhooks.
fn build_simulation_fixture() -> (WebhookSendFixture, tokio::task::JoinHandle<()>) {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200), ScriptedAnswer::Status(200)]);
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(
        fixture.operation_context.clone(),
    ));
    (fixture, subscriber)
}

async fn create_bounce_rule(fixture: &WebhookSendFixture, endpoint_id: &str) {
    create_rule(
        &fixture.app_router,
        &json!({
            "name": "Bounces", "endpoint_id": endpoint_id, "events": ["email.bounced"],
            "is_enabled": true,
        }),
    )
    .await;
}

async fn simulate_bounce(
    fixture: &WebhookSendFixture,
    email_id: &str,
    choice: Value,
) -> (u16, Value) {
    let mut simulate_input = json!({ "event": "bounced" });
    if let (Some(input_fields), Some(choice_fields)) =
        (simulate_input.as_object_mut(), choice.as_object())
    {
        input_fields.extend(choice_fields.clone());
    }
    fixture
        .post(
            &format!("/api/v1/emails/{email_id}/simulate"),
            &simulate_input,
        )
        .await
}

async fn list_email_deliveries(fixture: &WebhookSendFixture, email_id: &str) -> Vec<Value> {
    let (_, page) = call_api(
        &fixture.app_router,
        "GET",
        &format!("/api/v1/webhooks/deliveries?subject_id={email_id}"),
        None,
    )
    .await;
    page["items"].as_array().cloned().unwrap_or_default()
}

/// Waits up to two seconds for the email's first delivery to be queued, then sends it.
async fn send_first_delivery(fixture: &WebhookSendFixture, email_id: &str) -> Value {
    for _ in 0..200 {
        if !list_email_deliveries(fixture, email_id).await.is_empty() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    fixture.run_due().await;
    list_email_deliveries(fixture, email_id)
        .await
        .first()
        .cloned()
        .unwrap_or(Value::Null)
}

fn last_sent_request(fixture: &WebhookSendFixture) -> RecordedHttpRequest {
    fixture
        .sent_requests()
        .pop()
        .unwrap_or_else(|| panic!("a request was sent"))
}

fn read_header<'request>(
    sent_request: &'request RecordedHttpRequest,
    header_name: &str,
) -> &'request str {
    sent_request
        .headers
        .get(header_name)
        .map_or("", String::as_str)
}

async fn reveal_endpoint_secret(fixture: &WebhookSendFixture, endpoint_id: &str) -> Vec<u8> {
    let (_, revealed) = call_api(
        &fixture.app_router,
        "GET",
        &format!("/api/v1/webhooks/endpoints/{endpoint_id}/secret"),
        None,
    )
    .await;
    let encoded_key = revealed["secret"]
        .as_str()
        .and_then(|secret| secret.strip_prefix("whsec_"))
        .unwrap_or_default();
    BASE64.decode(encoded_key).unwrap_or_default()
}

/// Checks `webhook-signature` as the Standard Webhooks specification defines it, apart from
/// SendMock's own signer: base64 HMAC-SHA256 of `id.timestamp.body` under the decoded key.
fn has_valid_standard_signature(sent_request: &RecordedHttpRequest, signing_key: &[u8]) -> bool {
    let signed_content = format!(
        "{}.{}.{}",
        read_header(sent_request, "webhook-id"),
        read_header(sent_request, "webhook-timestamp"),
        sent_request.body
    );
    let expected_signature = BASE64.encode(
        hmac::sign(
            &hmac::Key::new(hmac::HMAC_SHA256, signing_key),
            signed_content.as_bytes(),
        )
        .as_ref(),
    );
    read_header(sent_request, "webhook-signature")
        .split(' ')
        .any(|signature| signature == format!("v1,{expected_signature}"))
}

/// Razorpay's `X-Razorpay-Signature`: hex HMAC-SHA256 of the body under the webhook secret.
fn sign_razorpay_body(body: &str) -> String {
    hmac::sign(
        &hmac::Key::new(hmac::HMAC_SHA256, RAZORPAY_SECRET.as_bytes()),
        body.as_bytes(),
    )
    .as_ref()
    .iter()
    .map(|byte| format!("{byte:02x}"))
    .collect()
}

/// An endpoint on a custom template that signs its body as Razorpay does.
async fn create_razorpay_signed_endpoint(fixture: &WebhookSendFixture) -> String {
    let (status, created_template) = fixture
        .post(
            "/api/v1/webhooks/templates",
            &json!({ "name": "Signed order" }),
        )
        .await;
    assert_eq!(status, 201, "{created_template}");
    let template_id = created_template["id"].as_str().unwrap_or_default();
    let (status, edited_template) = call_api(
        &fixture.app_router,
        "PATCH",
        &format!("/api/v1/webhooks/templates/{template_id}"),
        Some(&json!({
            "method": "POST", "content_type": "application/json",
            "header_templates": {
                "X-Razorpay-Signature": format!("{{{{ razorpay_signature(\"{RAZORPAY_SECRET}\") }}}}"),
            },
            "body_template": "{\"subject\": \"{{ data.subject }}\"}",
        })),
    )
    .await;
    assert_eq!(status, 200, "{edited_template}");
    fixture
        .create_endpoint(json!({ "template_id": template_id }))
        .await
}

// AC: WH-14.1
#[tokio::test]
async fn the_match_renders_each_endpoints_request_with_secrets_masked_and_sends_nothing() {
    let (fixture, subscriber) = build_simulation_fixture();
    fixture
        .create_variable(&json!({
            "name": "api_token", "kind": "secret", "scope": "global", "endpoint_id": null,
            "value": "tok_live_hidden", "random_mode": null, "description": "",
        }))
        .await;
    let rule_endpoint_id = fixture
        .create_endpoint(json!({ "headers": { "Authorization": "Bearer {{ vars.api_token }}" } }))
        .await;
    let chosen_endpoint_id = fixture.create_endpoint(json!({ "name": "Audit" })).await;
    create_bounce_rule(&fixture, &rule_endpoint_id).await;
    let email_id = send_email(&fixture.app_router, "sam@example.test", "Your receipt").await;

    let (status, matched) = fixture
        .post(
            MATCH_PATH,
            &json!({
                "event_type": "email.bounced", "subject_id": email_id, "include_requests": true,
                "webhook_endpoint_ids": [chosen_endpoint_id],
            }),
        )
        .await;

    assert_eq!(status, 200, "{matched}");
    let shown_requests = matched["webhook_requests"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let shown_endpoint_ids: Vec<&str> = shown_requests
        .iter()
        .filter_map(|shown_request| shown_request["endpoint_id"].as_str())
        .collect();
    assert_eq!(
        shown_endpoint_ids,
        [rule_endpoint_id.as_str(), chosen_endpoint_id.as_str()]
    );
    let rule_request = &shown_requests[0];
    assert_eq!(rule_request["method"], "POST");
    assert_eq!(rule_request["url"], "http://localhost:3000/hooks");
    assert_eq!(rule_request["event_type"], "email.bounced");
    assert_eq!(rule_request["headers"]["authorization"], "Bearer ••••••");
    let shown_body: Value = serde_json::from_str(rule_request["body"].as_str().unwrap_or_default())
        .unwrap_or(Value::Null);
    assert_eq!(shown_body["type"], "email.bounced");
    assert_eq!(shown_body["data"]["subject"], "Your receipt");
    assert!(list_email_deliveries(&fixture, &email_id).await.is_empty());
    assert!(fixture.sent_requests().is_empty());
    subscriber.abort();
}

// AC: WH-14.1
#[tokio::test]
async fn the_match_leaves_requests_out_unless_asked() {
    let (fixture, subscriber) = build_simulation_fixture();
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    create_bounce_rule(&fixture, &endpoint_id).await;

    let (status, matched) = fixture
        .post(MATCH_PATH, &json!({ "event_type": "email.bounced" }))
        .await;

    assert_eq!(status, 200, "{matched}");
    assert_eq!(matched["webhook_rules"].as_array().map(Vec::len), Some(1));
    assert!(matched.get("webhook_requests").is_none());
    subscriber.abort();
}

// AC: WH-14.3, WH-14.4
#[tokio::test]
async fn an_edited_body_is_delivered_byte_for_byte_with_a_standard_webhooks_signature_over_it() {
    let (fixture, subscriber) = build_simulation_fixture();
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    create_bounce_rule(&fixture, &endpoint_id).await;
    let email_id = send_email(&fixture.app_router, "sam@example.test", "Your receipt").await;

    let (status, simulated) = simulate_bounce(
        &fixture,
        &email_id,
        json!({ "webhook_requests": [{
            "endpoint_id": endpoint_id, "event_type": "email.bounced", "body": EDITED_BODY,
            "headers": { "X-Edited": "yes", "Webhook-Signature": "v1,stale" },
        }] }),
    )
    .await;
    let sent_delivery = send_first_delivery(&fixture, &email_id).await;

    assert_eq!(status, 200, "{simulated}");
    let sent_request = last_sent_request(&fixture);
    assert_eq!(sent_request.body, EDITED_BODY);
    assert_eq!(read_header(&sent_request, "x-edited"), "yes");
    let signing_key = reveal_endpoint_secret(&fixture, &endpoint_id).await;
    assert!(has_valid_standard_signature(&sent_request, &signing_key));
    assert_eq!(sent_delivery["is_edited"], true);
    assert_eq!(sent_delivery["trigger"], "auto");
    assert_eq!(sent_delivery["request"]["body"], EDITED_BODY);
    subscriber.abort();
}

// AC: WH-14.4
#[tokio::test]
async fn a_providers_signature_is_computed_over_the_edited_body_for_a_chosen_endpoint() {
    let (fixture, subscriber) = build_simulation_fixture();
    let endpoint_id = create_razorpay_signed_endpoint(&fixture).await;
    let email_id = send_email(&fixture.app_router, "sam@example.test", "Your receipt").await;

    let (status, simulated) = simulate_bounce(
        &fixture,
        &email_id,
        json!({
            "webhook_endpoint_ids": [endpoint_id],
            "webhook_requests": [{ "endpoint_id": endpoint_id, "body": EDITED_BODY }],
        }),
    )
    .await;
    let sent_delivery = send_first_delivery(&fixture, &email_id).await;

    assert_eq!(status, 200, "{simulated}");
    let sent_request = last_sent_request(&fixture);
    assert_eq!(sent_request.body, EDITED_BODY);
    assert_eq!(
        read_header(&sent_request, "x-razorpay-signature"),
        sign_razorpay_body(EDITED_BODY)
    );
    assert_eq!(sent_delivery["is_edited"], true);
    assert_eq!(sent_delivery["trigger"], "chosen");
    subscriber.abort();
}

// AC: WH-14.4
#[tokio::test]
async fn without_an_edit_the_rendered_request_is_sent_and_not_marked_edited() {
    let (fixture, subscriber) = build_simulation_fixture();
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    create_bounce_rule(&fixture, &endpoint_id).await;
    let email_id = send_email(&fixture.app_router, "sam@example.test", "Your receipt").await;

    let (status, _) = simulate_bounce(&fixture, &email_id, json!({})).await;
    let sent_delivery = send_first_delivery(&fixture, &email_id).await;

    assert_eq!(status, 200);
    let sent_body: Value =
        serde_json::from_str(&last_sent_request(&fixture).body).unwrap_or(Value::Null);
    assert_eq!(sent_body["type"], "email.bounced");
    assert_eq!(sent_delivery["is_edited"], false);
    subscriber.abort();
}

// AC: WH-14.4
#[tokio::test]
async fn an_edit_for_an_endpoint_that_is_not_chosen_is_refused_naming_it() {
    let (fixture, subscriber) = build_simulation_fixture();
    let chosen_endpoint_id = fixture.create_endpoint(json!({})).await;
    let other_endpoint_id = fixture.create_endpoint(json!({ "name": "Audit" })).await;
    let email_id = send_email(&fixture.app_router, "sam@example.test", "Your receipt").await;

    let (status, refusal) = simulate_bounce(
        &fixture,
        &email_id,
        json!({
            "webhook_endpoint_ids": [chosen_endpoint_id],
            "webhook_requests": [{ "endpoint_id": other_endpoint_id, "body": "{}" }],
        }),
    )
    .await;

    assert_eq!(status, 422, "{refusal}");
    assert!(
        refusal.to_string().contains(&other_endpoint_id),
        "{refusal}"
    );
    subscriber.abort();
}

// AC: WH-14.4
#[tokio::test]
async fn an_edit_applies_only_to_the_event_it_names() {
    let (fixture, subscriber) = build_simulation_fixture();
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    create_bounce_rule(&fixture, &endpoint_id).await;
    let email_id = send_email(&fixture.app_router, "sam@example.test", "Your receipt").await;

    simulate_bounce(
        &fixture,
        &email_id,
        json!({ "webhook_requests": [{
            "endpoint_id": endpoint_id, "event_type": "email.delivered", "body": EDITED_BODY,
        }] }),
    )
    .await;
    let sent_delivery = send_first_delivery(&fixture, &email_id).await;

    assert_ne!(last_sent_request(&fixture).body, EDITED_BODY);
    assert_eq!(sent_delivery["is_edited"], false);
    subscriber.abort();
}
