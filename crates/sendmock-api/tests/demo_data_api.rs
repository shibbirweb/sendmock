#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use std::time::Duration;

use sendmock_ops::{DemoLoadOutcome, load_demo_data, run_webhook_rule_subscriber};
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const DEMO_DATA_JSON: &str = include_str!("../../sendmock-ops/builtin/demo-data.json");

fn count_demo_steps(operation_id: &str) -> usize {
    let demo_data: Value = serde_json::from_str(DEMO_DATA_JSON).unwrap_or_default();
    demo_data["steps"].as_array().map_or(0, |demo_steps| {
        demo_steps
            .iter()
            .filter(|demo_step| demo_step["operation_id"] == operation_id)
            .count()
    })
}

async fn count_listed(app_router: &axum::Router, path: &str) -> usize {
    let (_, listed) = call_api(app_router, "GET", path, None).await;
    listed
        .get("items")
        .unwrap_or(&listed)
        .as_array()
        .map_or(0, Vec::len)
}

// AC: PL-09.1
#[tokio::test]
async fn the_demo_data_fills_every_area_through_the_operations() {
    let (app_router, operation_context) = build_test_app();

    let outcome = load_demo_data(&operation_context).await;

    assert!(
        matches!(outcome, Ok(DemoLoadOutcome::Loaded { step_count }) if step_count > 50),
        "{outcome:?}"
    );
    assert_eq!(
        count_listed(&app_router, "/api/v1/emails?limit=200").await,
        count_demo_steps("postSend")
    );
    assert_eq!(
        count_listed(&app_router, "/api/v1/sms?limit=200").await,
        count_demo_steps("postSms") + count_demo_steps("postSmsInbound") + 1
    );
    assert_eq!(
        count_listed(&app_router, "/api/v1/webhooks/endpoints").await,
        5
    );
    assert_eq!(count_listed(&app_router, "/api/v1/webhooks/rules").await, 4);
    assert!(count_listed(&app_router, "/api/v1/http/bins").await >= 5);
    assert_eq!(count_listed(&app_router, "/api/v1/payments").await, 5);
    assert_eq!(
        count_listed(&app_router, "/api/v1/verify?limit=50").await,
        1
    );
}

// AC: PL-09.2
#[tokio::test]
async fn the_demo_data_fires_rules_into_the_local_catcher_and_reset_clears_its_traffic() {
    let (app_router, operation_context) = build_test_app();
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(operation_context.clone()));
    tokio::task::yield_now().await;
    let _ = load_demo_data(&operation_context).await;

    let mut deliveries = Value::Null;
    for _ in 0..200 {
        deliveries = call_api(&app_router, "GET", "/api/v1/webhooks/deliveries", None)
            .await
            .1;
        if deliveries["items"]
            .as_array()
            .is_some_and(|items| !items.is_empty())
        {
            break;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    subscriber.abort();
    let (_, endpoints) = call_api(&app_router, "GET", "/api/v1/webhooks/endpoints", None).await;
    let (reset_status, _) = call_api(&app_router, "POST", "/api/v1/reset", Some(&json!({}))).await;

    let delivery_count = deliveries["items"].as_array().map_or(0, Vec::len);
    assert!(delivery_count > 0, "{deliveries}");
    let endpoint_urls: Vec<&str> = endpoints
        .as_array()
        .map(|listed| {
            listed
                .iter()
                .filter_map(|endpoint| endpoint["url"].as_str())
                .collect()
        })
        .unwrap_or_default();
    assert!(
        endpoint_urls
            .iter()
            .all(|endpoint_url| endpoint_url.starts_with("http://127.0.0.1:8025/catch/demo-")),
        "{endpoint_urls:?}"
    );
    assert!(reset_status < 300, "{reset_status}");
    assert_eq!(count_listed(&app_router, "/api/v1/emails").await, 0);
    assert_eq!(count_listed(&app_router, "/api/v1/payments").await, 0);
    // Without a seed file, reset keeps configuration, the demo's as anyone's.
    assert_eq!(
        count_listed(&app_router, "/api/v1/webhooks/endpoints").await,
        5
    );
}

// AC: PL-09.3
#[tokio::test]
async fn an_instance_with_data_gets_no_demo_data() {
    let (app_router, operation_context) = build_test_app();
    let (send_status, sent) = call_api(
        &app_router,
        "POST",
        "/api/v1/send",
        Some(
            &json!({ "from": "app@example.test", "to": ["user@example.test"], "subject": "Mine", "text": "Mine." }),
        ),
    )
    .await;
    assert!(send_status < 300, "{send_status} {sent}");
    // The native send stores the email in the background.
    for _ in 0..200 {
        if count_listed(&app_router, "/api/v1/emails").await == 1 {
            break;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }

    let outcome = load_demo_data(&operation_context).await;

    assert!(
        matches!(outcome, Ok(DemoLoadOutcome::SkippedBecauseNotEmpty)),
        "{outcome:?}"
    );
    assert_eq!(count_listed(&app_router, "/api/v1/emails").await, 1);
}
