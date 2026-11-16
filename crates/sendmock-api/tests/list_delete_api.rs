#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod project_requests;
    pub mod scripted_webhook_sender;
    pub mod test_app;
    pub mod webhook_samples;
    pub mod webhook_send_fixture;
}

use axum::body::Body;
use axum::http::Request;
use sendmock_ops::build_operation_registry;
use serde_json::{Value, json};
use support::project_requests::{create_project, post_in_project};
use support::scripted_webhook_sender::ScriptedAnswer;
use support::test_app::call_api;
use support::webhook_send_fixture::{WebhookSendFixture, build_send_fixture};
use tower::ServiceExt;

async fn post_ok(fixture: &WebhookSendFixture, path: &str, request_body: Value) -> Value {
    let (status, answer) = fixture.post(path, &request_body).await;
    assert!((200..300).contains(&status), "{path}: {status} {answer}");
    answer
}

async fn delete_at(fixture: &WebhookSendFixture, path: &str) -> (u16, Value) {
    call_api(&fixture.app_router, "DELETE", path, None).await
}

/// How many rows a list answers, whether it pages (`total_count`) or not.
async fn count_at(fixture: &WebhookSendFixture, list_path: &str) -> u64 {
    let (status, listed) = call_api(&fixture.app_router, "GET", list_path, None).await;
    assert_eq!(status, 200, "{list_path}: {listed}");
    listed["total_count"]
        .as_u64()
        .or_else(|| listed.as_array().map(|items| items.len() as u64))
        .unwrap_or_default()
}

async fn list_cleared_events(fixture: &WebhookSendFixture) -> Vec<Value> {
    let (_, recent) = call_api(
        &fixture.app_router,
        "GET",
        "/api/v1/events/recent?type=traffic.cleared",
        None,
    )
    .await;
    recent["events"]
        .as_array()
        .or_else(|| recent.as_array())
        .cloned()
        .unwrap_or_default()
}

/// An email, an SMS, a verification, a caught request and a finished delivery, plus one
/// delivery still waiting to be sent.
async fn create_traffic(fixture: &WebhookSendFixture, endpoint_id: &str) {
    let email = json!({ "from": "app@shop.test", "to": ["sam@example.test"], "subject": "Hi", "text": "hello" });
    post_ok(fixture, "/api/v1/send", email).await;
    let sms = json!({ "from": "+15550001111", "to": "+8801700000000", "body": "code 482913" });
    post_ok(fixture, "/api/v1/sms", sms).await;
    post_ok(
        fixture,
        "/api/v1/samples/verification",
        json!({ "to": "+14155550101" }),
    )
    .await;
    post_ok(fixture, "/catch/orders", json!({ "order": 1 })).await;
    fixture.send_manually(endpoint_id, &json!({})).await;
    fixture.run_due().await;
    fixture.send_manually(endpoint_id, &json!({})).await;
}

// AC: UI-14.4
#[tokio::test]
async fn delete_all_with_a_project_deletes_only_that_projects_messages() {
    let fixture = build_send_fixture(&[]);
    create_project(&fixture.app_router, "shop").await;
    let sms = json!({ "from": "+15550001111", "to": "+8801700000000", "body": "shop" });
    let (status, _) = post_in_project(&fixture.app_router, "/api/v1/sms", &sms, "shop").await;
    assert_eq!(status, 201);
    post_ok(
        &fixture,
        "/api/v1/sms",
        json!({ "from": "+15550001111", "to": "+8801700000000", "body": "default" }),
    )
    .await;

    let (delete_status, _) = delete_at(&fixture, "/api/v1/sms?project=shop").await;

    assert_eq!(delete_status, 204);
    assert_eq!(count_at(&fixture, "/api/v1/sms?project=shop").await, 0);
    assert_eq!(count_at(&fixture, "/api/v1/sms?project=default").await, 1);
}

// AC: UI-14.4
#[tokio::test]
async fn delete_all_with_a_filter_deletes_only_the_matching_items() {
    let fixture = build_send_fixture(&[]);
    for recipient in ["+14155550101", "+14155550102"] {
        post_ok(
            &fixture,
            "/api/v1/samples/verification",
            json!({ "to": recipient }),
        )
        .await;
    }

    let (status, _) = delete_at(&fixture, "/api/v1/verify?to=0101").await;

    assert_eq!(status, 204);
    assert_eq!(count_at(&fixture, "/api/v1/verify").await, 1);
    assert_eq!(count_at(&fixture, "/api/v1/verify?to=0102").await, 1);
}

// AC: UI-14.5
#[tokio::test]
async fn a_delivery_in_flight_refuses_delete_and_survives_delete_all() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200)]);
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    fixture.send_manually(&endpoint_id, &json!({})).await;
    fixture.run_due().await;
    let waiting = fixture.send_manually(&endpoint_id, &json!({})).await;
    let waiting_id = waiting["id"].as_str().unwrap_or_default().to_owned();

    let (delete_one_status, refusal) = delete_at(
        &fixture,
        &format!("/api/v1/webhooks/deliveries/{waiting_id}"),
    )
    .await;
    let (delete_all_status, _) = delete_at(&fixture, "/api/v1/webhooks/deliveries").await;
    let (_, remaining) = call_api(
        &fixture.app_router,
        "GET",
        "/api/v1/webhooks/deliveries",
        None,
    )
    .await;

    assert_eq!(delete_one_status, 409, "{refusal}");
    assert_eq!(refusal["error"]["code"], "delivery_in_flight", "{refusal}");
    assert_eq!(delete_all_status, 204);
    assert_eq!(remaining["total_count"], 1, "{remaining}");
    assert_eq!(remaining["items"][0]["id"], waiting_id);
}

// AC: UI-14.5
#[tokio::test]
async fn a_finished_delivery_is_deleted_by_its_id() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200)]);
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    let finished = fixture.send_manually(&endpoint_id, &json!({})).await;
    fixture.run_due().await;
    let finished_id = finished["id"].as_str().unwrap_or_default();

    let (status, _) = delete_at(
        &fixture,
        &format!("/api/v1/webhooks/deliveries/{finished_id}"),
    )
    .await;

    assert_eq!(status, 204);
    assert_eq!(count_at(&fixture, "/api/v1/webhooks/deliveries").await, 0);
}

// AC: UI-14.6
#[tokio::test]
async fn delete_all_traffic_empties_every_list_and_keeps_the_configuration() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200)]);
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    create_traffic(&fixture, &endpoint_id).await;
    let bin_count = count_at(&fixture, "/api/v1/http/bins").await;

    let (status, _) = delete_at(&fixture, "/api/v1/traffic").await;

    assert_eq!(status, 204);
    for traffic_path in [
        "/api/v1/emails",
        "/api/v1/sms",
        "/api/v1/verify",
        "/api/v1/push",
        "/api/v1/http/requests",
        "/api/v1/payments",
        "/api/v1/payments/subscriptions",
        "/api/v1/logs/smtp",
        "/api/v1/logs/http",
    ] {
        assert_eq!(count_at(&fixture, traffic_path).await, 0, "{traffic_path}");
    }
    // The delivery still waiting to be sent stays with the dispatcher.
    assert_eq!(count_at(&fixture, "/api/v1/webhooks/deliveries").await, 1);
    assert_eq!(count_at(&fixture, "/api/v1/webhooks/endpoints").await, 1);
    assert_eq!(count_at(&fixture, "/api/v1/http/bins").await, bin_count);
}

// AC: UI-14.7
#[tokio::test]
async fn a_delete_all_publishes_one_traffic_cleared_event() {
    let fixture = build_send_fixture(&[]);
    for recipient in ["+14155550101", "+14155550102"] {
        post_ok(
            &fixture,
            "/api/v1/samples/verification",
            json!({ "to": recipient }),
        )
        .await;
    }

    delete_at(&fixture, "/api/v1/verify").await;
    let cleared_events = list_cleared_events(&fixture).await;

    assert_eq!(cleared_events.len(), 1, "{cleared_events:?}");
    assert_eq!(
        cleared_events[0]["data"],
        json!({ "kinds": ["verification"], "project": null, "deleted_count": 2 })
    );
}

// AC: UI-14.7
#[tokio::test]
async fn a_rule_cannot_listen_to_traffic_cleared() {
    let fixture = build_send_fixture(&[]);
    let endpoint_id = fixture.create_endpoint(json!({})).await;

    let (status, answer) = fixture
        .post(
            "/api/v1/webhooks/rules",
            &json!({ "name": "On clear", "endpoint_id": endpoint_id, "events": ["traffic.cleared"], "filter": null, "is_enabled": true }),
        )
        .await;

    assert_eq!(status, 400, "{answer}");
    assert_eq!(answer["error"]["field"], "events", "{answer}");
}

/// The list actions A17 added, by `operationId`.
const LIST_ACTION_OPERATIONS: [&str; 20] = [
    "patchSmsThreadsByThreadId",
    "deleteSmsThreadsByThreadId",
    "patchPushByPushId",
    "patchHttpRequestsByRequestId",
    "deleteHttpRequestsByRequestId",
    "deleteVerify",
    "deleteVerifyByVerificationSid",
    "deleteWebhooksDeliveries",
    "deleteWebhooksDeliveriesByDeliveryId",
    "deletePayments",
    "deletePaymentsByPaymentId",
    "deletePaymentsSubscriptions",
    "deletePaymentsSubscriptionsBySubscriptionId",
    "deleteLogsSmtp",
    "deleteLogsSmtpBySessionId",
    "deleteLogsHttp",
    "deleteLogsHttpByRequestId",
    "deleteTraffic",
    "deleteSms",
    "deleteEmails",
];

// AC: UI-14.8
#[test]
fn every_list_action_is_an_operation_with_a_cli_command_and_an_mcp_tool() {
    let operation_registry = build_operation_registry();

    for operation_id in LIST_ACTION_OPERATIONS {
        let operation = operation_registry
            .find_by_operation_id(operation_id)
            .unwrap_or_else(|| panic!("{operation_id} is registered"));
        let definition = operation.definition();
        assert!(
            definition.cli_usage.starts_with("sendmock "),
            "{operation_id}"
        );
        assert!(
            definition.mcp_tool.starts_with("sendmock_"),
            "{operation_id}"
        );
        // Deletes ask for --yes in the CLI and are marked destructive in MCP.
        assert_eq!(
            definition.is_destructive,
            operation_id.starts_with("delete"),
            "{operation_id}"
        );
    }
}

// AC: UI-14.8
#[tokio::test]
async fn every_delete_answers_204_for_a_missing_item_and_an_empty_list() {
    let fixture = build_send_fixture(&[]);

    for delete_path in [
        "/api/v1/verify/VEmissing",
        "/api/v1/payments/missing",
        "/api/v1/payments/subscriptions/missing",
        "/api/v1/logs/smtp/missing",
        "/api/v1/logs/http/missing",
        "/api/v1/http/requests/missing",
        "/api/v1/sms/threads/sms-1-2",
        "/api/v1/webhooks/deliveries/missing",
        "/api/v1/payments",
        "/api/v1/payments/subscriptions",
        "/api/v1/logs/smtp?result=failed",
        "/api/v1/logs/http?status_class=4xx",
        "/api/v1/emails?project=default",
        "/api/v1/push",
    ] {
        let (status, answer) = delete_at(&fixture, delete_path).await;
        assert_eq!(status, 204, "{delete_path}: {answer}");
    }
}

// AC: UI-14.8
#[tokio::test]
async fn a_logged_api_request_is_deleted_by_its_id() {
    let fixture = build_send_fixture(&[]);
    let twilio_request = Request::post(
        "/providers/twilio/2010-04-01/Accounts/ACtest00000000000000000000000000/Messages.json",
    )
    .header("content-type", "application/x-www-form-urlencoded")
    // `ACtest...:any-token`, as an SDK configured with any credentials sends it.
    .header(
        "authorization",
        "Basic QUN0ZXN0MDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDA6YW55LXRva2Vu",
    )
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
    let (_, logged) = call_api(&fixture.app_router, "GET", "/api/v1/logs/http", None).await;
    let request_id = logged["items"][0]["id"].as_str().unwrap_or_default();

    let (status, _) = delete_at(&fixture, &format!("/api/v1/logs/http/{request_id}")).await;

    assert_eq!(status, 204);
    assert_eq!(count_at(&fixture, "/api/v1/logs/http").await, 0);
}
