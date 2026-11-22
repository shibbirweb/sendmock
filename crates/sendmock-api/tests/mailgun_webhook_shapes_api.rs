#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod email_provider_requests;
    pub mod manual_clock;
    pub mod scripted_webhook_sender;
    pub mod test_app;
    pub mod webhook_samples;
    pub mod webhook_send_fixture;
}

use sendmock_ops::run_webhook_rule_subscriber;
use serde_json::{Value, json};
use support::email_provider_requests::send_provider_request;
use support::scripted_webhook_sender::ScriptedAnswer;
use support::test_app::call_api;
use support::webhook_samples::wait_for_deliveries_at;
use support::webhook_send_fixture::{WebhookSendFixture, build_send_fixture, global_variable};

const MAILGUN_FAILED_EVENT_WEBHOOK: &str =
    include_str!("fixtures/provider_webhooks/mailgun_failed_event_webhook.json");
const BOUNDARY: &str = "mailgun-boundary";

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

/// An email sent through Mailgun with user variables; answers SendMock's id of it.
async fn send_with_user_variables(fixture: &WebhookSendFixture) -> String {
    let mut form_body = String::new();
    for (field_name, field_value) in [
        ("from", "Shop <shop@mg.shop.test>"),
        ("to", "sam@example.test"),
        ("subject", "Your order"),
        ("text", "Shipped"),
        ("v:order-id", "A-1001"),
        ("h:X-Mailgun-Variables", r#"{"customer_id": 42}"#),
    ] {
        form_body.push_str(&format!(
            "--{BOUNDARY}\r\nContent-Disposition: form-data; name=\"{field_name}\"\r\n\r\n{field_value}\r\n"
        ));
    }
    form_body.push_str(&format!("--{BOUNDARY}--\r\n"));
    let reply = send_provider_request(
        &fixture.app_router,
        "/providers/mailgun/v3/mg.shop.test/messages",
        &format!("multipart/form-data; boundary={BOUNDARY}"),
        form_body.into_bytes(),
    )
    .await;
    assert_eq!(reply.status, 200, "{}", reply.body_text);
    let (_, email_page) = call_api(&fixture.app_router, "GET", "/api/v1/emails", None).await;
    email_page["items"][0]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

/// Simulates a bounce of the type for the email, sent to the endpoint; answers the body sent.
async fn send_simulated_bounce(
    fixture: &WebhookSendFixture,
    email_id: &str,
    endpoint_id: &str,
    bounce_type: &str,
) -> Value {
    let (status, simulated) = fixture
        .post(
            &format!("/api/v1/emails/{email_id}/simulate"),
            &json!({ "event": "bounced", "bounce_type": bounce_type, "webhook_endpoint_ids": [endpoint_id] }),
        )
        .await;
    assert_eq!(status, 204, "{simulated}");
    wait_for_deliveries_at(
        &fixture.app_router,
        &format!("/api/v1/webhooks/deliveries?subject_id={email_id}"),
        1,
    )
    .await;
    fixture.run_due().await;
    serde_json::from_str(&fixture.last_sent_body()).unwrap_or(Value::Null)
}

/// A fixture whose rule subscriber runs, with an endpoint on `mailgun.events` and its signing
/// key; the subscriber stops with the test's runtime.
async fn build_mailgun_fixture() -> (WebhookSendFixture, String) {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200), ScriptedAnswer::Status(200)]);
    tokio::spawn(run_webhook_rule_subscriber(
        fixture.operation_context.clone(),
    ));
    fixture
        .create_variable(&global_variable(
            "mailgun_signing_key",
            "secret",
            "key-test",
        ))
        .await;
    let endpoint_id = fixture
        .create_endpoint(json!({ "template_id": "mailgun.events" }))
        .await;
    (fixture, endpoint_id)
}

// AC: EM-25.1 EM-25.2
#[tokio::test]
async fn a_soft_bounce_is_a_temporary_failure_with_its_code_and_the_user_variables() {
    let (fixture, endpoint_id) = build_mailgun_fixture().await;
    let email_id = send_with_user_variables(&fixture).await;

    let webhook = send_simulated_bounce(&fixture, &email_id, &endpoint_id, "soft").await;

    check_against_fixture(MAILGUN_FAILED_EVENT_WEBHOOK, &webhook);
    let event_data = &webhook["event-data"];
    assert_eq!(event_data["severity"], "temporary", "{webhook}");
    assert_eq!(event_data["delivery-status"]["code"], 452);
    assert_eq!(event_data["delivery-status"]["message"], "mailbox full");
    assert_eq!(
        event_data["user-variables"],
        json!({ "customer_id": 42, "order-id": "A-1001" })
    );
}

// AC: EM-25.2
#[tokio::test]
async fn a_hard_bounce_is_a_permanent_failure() {
    let (fixture, endpoint_id) = build_mailgun_fixture().await;
    let email_id = send_with_user_variables(&fixture).await;

    let webhook = send_simulated_bounce(&fixture, &email_id, &endpoint_id, "hard").await;

    assert_eq!(webhook["event-data"]["severity"], "permanent", "{webhook}");
    assert_eq!(webhook["event-data"]["log-level"], "error");
    assert_eq!(webhook["event-data"]["delivery-status"]["code"], 550);
}

// AC: EM-25.2
#[tokio::test]
async fn a_render_of_a_bounced_email_shows_its_bounce() {
    let (fixture, endpoint_id) = build_mailgun_fixture().await;
    let email_id = send_with_user_variables(&fixture).await;
    send_simulated_bounce(&fixture, &email_id, &endpoint_id, "soft").await;

    let (status, rendered) = call_api(
        &fixture.app_router,
        "POST",
        "/api/v1/webhooks/templates/native/render",
        Some(&json!({ "email_id": email_id })),
    )
    .await;

    assert_eq!(status, 200, "{rendered}");
    let rendered_body: Value =
        serde_json::from_str(rendered["body"].as_str().unwrap_or_default()).unwrap_or(Value::Null);
    assert_eq!(
        rendered_body["data"]["bounce"]["type"], "soft",
        "{rendered_body}"
    );
    assert_eq!(rendered_body["data"]["bounce"]["code"], 452);
    assert_eq!(rendered_body["data"]["bounce_type"], "soft");
}
