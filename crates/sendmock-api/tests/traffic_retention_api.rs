#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod scripted_webhook_sender;
    pub mod test_app;
    pub mod webhook_samples;
    pub mod webhook_send_fixture;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::scripted_webhook_sender::ScriptedAnswer;
use support::test_app::call_api;
use support::webhook_send_fixture::{WebhookSendFixture, build_send_fixture, global_variable};
use tower::ServiceExt;

const TWILIO_MESSAGES_PATH: &str =
    "/providers/twilio/2010-04-01/Accounts/ACtest00000000000000000000000000/Messages.json";
/// `ACtest...:any-token`, as an SDK configured with any credentials sends it.
const ANY_BASIC_AUTH: &str = "Basic QUN0ZXN0MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA6YW55LXRva2Vu";

/// How many rows a list answers, whether it pages (`total_count` or `items`) or not.
fn count_listed(listed: &Value) -> usize {
    if let Some(total_count) = listed["total_count"].as_u64() {
        return usize::try_from(total_count).unwrap_or_default();
    }
    listed["items"]
        .as_array()
        .or(listed.as_array())
        .map_or(0, Vec::len)
}

async fn count_at(fixture: &WebhookSendFixture, list_path: &str) -> usize {
    let (status, listed) = call_api(&fixture.app_router, "GET", list_path, None).await;
    assert_eq!(status, 200, "{list_path}: {listed}");
    count_listed(&listed)
}

/// An SMS through the Twilio API, which also lands in the API request log.
async fn send_twilio_sms(fixture: &WebhookSendFixture) {
    let twilio_request = Request::post(TWILIO_MESSAGES_PATH)
        .header("content-type", "application/x-www-form-urlencoded")
        .header("authorization", ANY_BASIC_AUTH)
        .body(Body::from(
            "To=%2B8801700000000&From=%2B15005550006&Body=Logged",
        ))
        .unwrap_or_else(|request_error| panic!("a valid request: {request_error}"));
    let twilio_response = fixture
        .app_router
        .clone()
        .oneshot(twilio_request)
        .await
        .unwrap_or_else(|response_error| panic!("a response: {response_error}"));
    assert_eq!(twilio_response.status().as_u16(), 201);
}

async fn post_ok(fixture: &WebhookSendFixture, path: &str, request_body: Value) -> Value {
    let (status, answer) = fixture.post(path, &request_body).await;
    assert!((200..300).contains(&status), "{path}: {status} {answer}");
    answer
}

/// Two of every kind of traffic: emails, SMS sent natively and through Twilio (logged),
/// verifications, caught HTTP requests and finished webhook deliveries, plus one delivery
/// still waiting to be sent.
async fn create_traffic_twice(fixture: &WebhookSendFixture, endpoint_id: &str) {
    for copy_number in 1..=2 {
        let email = json!({ "from": "app@shop.test", "to": ["sam@example.test"], "subject": "Hello", "text": format!("email {copy_number}") });
        post_ok(fixture, "/api/v1/send", email).await;
        let sms = json!({ "from": "+15550001111", "to": "+8801700000000", "body": format!("sms {copy_number}") });
        post_ok(fixture, "/api/v1/sms", sms).await;
        send_twilio_sms(fixture).await;
        let verification = json!({ "to": format!("+1415555010{copy_number}") });
        post_ok(fixture, "/api/v1/samples/verification", verification).await;
        post_ok(
            fixture,
            "/catch/retention/orders",
            json!({ "order": copy_number }),
        )
        .await;
        fixture.send_manually(endpoint_id, &json!({})).await;
    }
    fixture.run_due().await;
    fixture.send_manually(endpoint_id, &json!({})).await;
}

/// Configuration of every kind traffic retention must leave alone.
async fn create_configuration(fixture: &WebhookSendFixture, endpoint_id: &str) {
    let rule = json!({ "name": "All mail", "endpoint_id": endpoint_id, "events": ["email.received"], "filter": null, "is_enabled": true });
    post_ok(fixture, "/api/v1/webhooks/rules", rule).await;
    fixture
        .create_variable(&global_variable("tenant", "text", "acme"))
        .await;
    let number = json!({
        "number": "+15550007700", "label": "Support", "channels": ["sms"], "inbound_url": null,
        "inbound_method": "POST", "inbound_fallback_url": null, "inbound_template_id": null,
        "status_callback_url": null, "messaging_service_sid": null,
    });
    post_ok(fixture, "/api/v1/numbers", number).await;
}

/// Saves the newest delivery, so a saved delivery exists, then lowers both limits to one.
async fn save_a_delivery_and_lower_the_limits(fixture: &WebhookSendFixture) {
    let (_, deliveries) = call_api(
        &fixture.app_router,
        "GET",
        "/api/v1/webhooks/deliveries",
        None,
    )
    .await;
    let first_delivery_id = deliveries["items"][0]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let saved = json!({ "name": "Kept", "delivery_id": first_delivery_id });
    post_ok(fixture, "/api/v1/webhooks/saved", saved).await;
    let limits = json!({ "max_emails": 1, "max_sms": 1 });
    call_api(
        &fixture.app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&limits),
    )
    .await;
}

const TRAFFIC_PATHS: [&str; 5] = [
    "/api/v1/emails",
    "/api/v1/sms",
    "/api/v1/verify",
    "/api/v1/http/requests",
    "/api/v1/logs/http",
];

const CONFIGURATION_PATHS: [&str; 5] = [
    "/api/v1/webhooks/endpoints",
    "/api/v1/webhooks/rules",
    "/api/v1/webhooks/saved",
    "/api/v1/webhooks/variables",
    "/api/v1/numbers",
];

// AC: PL-08.1
#[tokio::test]
async fn pruning_trims_every_kind_of_traffic_and_never_configuration() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200), ScriptedAnswer::Status(200)]);
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    create_configuration(&fixture, &endpoint_id).await;
    create_traffic_twice(&fixture, &endpoint_id).await;
    save_a_delivery_and_lower_the_limits(&fixture).await;
    for traffic_path in TRAFFIC_PATHS {
        assert!(
            count_at(&fixture, traffic_path).await >= 2,
            "{traffic_path}"
        );
    }
    assert_eq!(count_at(&fixture, "/api/v1/webhooks/deliveries").await, 3);

    sendmock_ops::prune_traffic(&fixture.operation_context)
        .await
        .unwrap_or_else(|prune_error| panic!("pruning: {prune_error}"));

    for traffic_path in TRAFFIC_PATHS {
        assert_eq!(count_at(&fixture, traffic_path).await, 1, "{traffic_path}");
    }
    // One finished delivery is kept, and the one still waiting to be sent is never pruned.
    assert_eq!(count_at(&fixture, "/api/v1/webhooks/deliveries").await, 2);
    for configuration_path in CONFIGURATION_PATHS {
        assert_eq!(
            count_at(&fixture, configuration_path).await,
            1,
            "{configuration_path}"
        );
    }
}
