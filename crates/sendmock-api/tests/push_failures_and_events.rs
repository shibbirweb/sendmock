#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use std::time::Duration;

use sendmock_ops::run_webhook_rule_subscriber;
use serde_json::{Value, json};
use support::test_app::{build_test_app, build_test_app_with, call_api};
use support::webhook_samples::{create_endpoint, create_rule};

const FCM_SEND_PATH: &str = "/providers/fcm/v1/projects/shop-app/messages:send";
const EXPO_SEND_PATH: &str = "/providers/expo/--/api/v2/push/send";
const ONESIGNAL_PATH: &str = "/providers/onesignal/notifications";

fn fcm_send(device_token: &str) -> Value {
    json!({ "message": { "token": device_token, "notification": { "title": "Order shipped" } } })
}

fn onesignal_send(subscription_ids: &[&str], alias_ids: &[&str]) -> Value {
    json!({
        "app_id": "5eb5a37e-b458-11e3-ac11-000c2940e62c",
        "contents": { "en": "Order shipped" },
        "include_subscription_ids": subscription_ids,
        "include_aliases": { "external_id": alias_ids },
    })
}

async fn stored_failures(app_router: &axum::Router) -> Value {
    let (_, page) = call_api(app_router, "GET", "/api/v1/push?status=failed", None).await;
    page
}

// AC: PN-01.4
#[tokio::test]
async fn fcm_magic_tokens_answer_googles_errors_and_are_stored_as_failed() {
    let (app_router, _) = build_test_app();
    let mut answers = Vec::new();
    for device_token in ["unregistered-1", "invalid-1", "throttled-1"] {
        answers.push(
            call_api(
                &app_router,
                "POST",
                FCM_SEND_PATH,
                Some(&fcm_send(device_token)),
            )
            .await,
        );
    }

    let failures = stored_failures(&app_router).await;

    let statuses: Vec<u16> = answers.iter().map(|(status, _)| *status).collect();
    assert_eq!(statuses, vec![404, 400, 429]);
    let error_codes: Vec<&Value> = answers
        .iter()
        .map(|(_, answer)| &answer["error"]["details"][0]["errorCode"])
        .collect();
    assert_eq!(
        error_codes,
        vec![
            &json!("UNREGISTERED"),
            &json!("INVALID_ARGUMENT"),
            &json!("QUOTA_EXCEEDED")
        ]
    );
    assert_eq!(answers[2].1["error"]["status"], "RESOURCE_EXHAUSTED");
    assert_eq!(failures["total_count"], 3);
    assert_eq!(failures["items"][2]["error_reason"], "UNREGISTERED");
    assert_eq!(failures["items"][2]["response_status"], 404);
}

// AC: PN-01.4
#[tokio::test]
async fn expo_magic_tokens_get_error_tickets_beside_the_delivered_ones() {
    let (app_router, _) = build_test_app();
    let batch = json!([{
        "to": [
            "ExponentPushToken[ok]",
            "ExponentPushToken[unregistered]",
            "ExponentPushToken[throttled]",
        ],
        "title": "Order shipped",
    }]);

    let (status, answer) = call_api(&app_router, "POST", EXPO_SEND_PATH, Some(&batch)).await;
    let failures = stored_failures(&app_router).await;

    assert_eq!(status, 200, "{answer}");
    assert_eq!(answer["data"][0]["status"], "ok");
    assert_eq!(answer["data"][1]["status"], "error");
    assert_eq!(answer["data"][1]["details"]["error"], "DeviceNotRegistered");
    assert_eq!(
        answer["data"][1]["details"]["expoPushToken"],
        "ExponentPushToken[unregistered]"
    );
    assert_eq!(answer["data"][2]["details"]["error"], "MessageRateExceeded");
    assert_eq!(failures["total_count"], 2);
}

// AC: PN-01.4
#[tokio::test]
async fn onesignal_lists_refused_recipients_and_rate_limits_a_throttled_one() {
    let (app_router, _) = build_test_app();

    let (mixed_status, mixed) = call_api(
        &app_router,
        "POST",
        ONESIGNAL_PATH,
        Some(&onesignal_send(
            &["subscription-1", "unregistered-2"],
            &["invalid-user"],
        )),
    )
    .await;
    let (all_refused_status, all_refused) = call_api(
        &app_router,
        "POST",
        ONESIGNAL_PATH,
        Some(&onesignal_send(&["unregistered-3"], &[])),
    )
    .await;
    let (throttled_status, throttled) = call_api(
        &app_router,
        "POST",
        ONESIGNAL_PATH,
        Some(&onesignal_send(&["throttled-4"], &[])),
    )
    .await;

    assert_eq!(mixed_status, 200, "{mixed}");
    assert_eq!(mixed["id"].as_str().map(str::len), Some(36));
    assert_eq!(
        mixed["errors"]["invalid_player_ids"],
        json!(["unregistered-2"])
    );
    assert_eq!(
        mixed["errors"]["invalid_aliases"]["external_id"],
        json!(["invalid-user"])
    );
    assert_eq!(all_refused_status, 200);
    assert_eq!(
        all_refused,
        json!({ "id": "", "errors": ["All included players are not subscribed"] })
    );
    assert_eq!(throttled_status, 429);
    assert_eq!(throttled["errors"][0], "API rate limit exceeded");
    assert_eq!(stored_failures(&app_router).await["total_count"], 4);
}

// AC: PN-01.5
#[tokio::test]
async fn push_events_reach_webhook_rules_filtered_on_the_token_and_title() {
    let (app_router, operation_context) =
        build_test_app_with(|operation_context| operation_context);
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(operation_context.clone()));
    tokio::task::yield_now().await;
    let endpoint_id = create_endpoint(&app_router, "Push events").await;
    create_rule(
        &app_router,
        &json!({
            "name": "Failed pushes to the test phone", "endpoint_id": endpoint_id,
            "events": ["push.sent", "push.failed"], "is_enabled": true,
            "filter": { "all": [
                { "field": "token", "operator": "contains", "value": "test-phone" },
                { "field": "title", "operator": "equals", "value": "Order shipped" },
            ] },
        }),
    )
    .await;

    for device_token in ["test-phone-1", "test-phone-unregistered", "other-phone"] {
        call_api(
            &app_router,
            "POST",
            FCM_SEND_PATH,
            Some(&fcm_send(device_token)),
        )
        .await;
    }
    tokio::time::sleep(Duration::from_millis(200)).await;
    subscriber.abort();

    let (_, deliveries) = call_api(&app_router, "GET", "/api/v1/webhooks/deliveries", None).await;
    let mut event_types: Vec<String> = deliveries["items"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|delivery| delivery["event_type"].as_str().map(str::to_owned))
        .collect();
    event_types.sort();
    assert_eq!(
        event_types,
        vec!["push.failed", "push.sent"],
        "{deliveries}"
    );
}
