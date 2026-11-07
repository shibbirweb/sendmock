#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use std::time::Duration;

use sendmock_ops::run_webhook_rule_subscriber;
use serde_json::{Value, json};
use support::test_app::{build_test_app_with, call_api};
use support::webhook_samples::{create_endpoint, create_rule, send_email};

/// Waits up to two seconds for `delivery_count` queued deliveries.
async fn wait_for_deliveries(app_router: &axum::Router, delivery_count: usize) -> Vec<Value> {
    let mut deliveries = Vec::new();
    for _ in 0..200 {
        let (_, page) = call_api(app_router, "GET", "/api/v1/webhooks/deliveries", None).await;
        deliveries = page["items"].as_array().cloned().unwrap_or_default();
        if deliveries.len() >= delivery_count {
            break;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    deliveries
}

fn rule_input(rule_name: &str, endpoint_id: &str, events: Value, filter: Value) -> Value {
    json!({
        "name": rule_name, "endpoint_id": endpoint_id, "events": events,
        "filter": filter, "is_enabled": true,
    })
}

/// Rules in this order: support mail to Support desk, every SMS to Support desk, a disabled
/// catch-all and an enabled catch-all to Audit log.
async fn create_routing_rules(app_router: &axum::Router) {
    let support_endpoint = create_endpoint(app_router, "Support desk").await;
    let audit_endpoint = create_endpoint(app_router, "Audit log").await;
    let support_filter = json!({ "all": [
        { "field": "to", "operator": "matches", "value": "*@support.local" },
        { "field": "header:x-tenant", "operator": "equals", "value": "ACME" },
    ] });
    create_rule(
        app_router,
        &rule_input(
            "Support mail",
            &support_endpoint,
            json!(["email.received"]),
            support_filter,
        ),
    )
    .await;
    create_rule(
        app_router,
        &rule_input(
            "Every SMS",
            &support_endpoint,
            json!(["sms.sent"]),
            Value::Null,
        ),
    )
    .await;
    let mut disabled_rule = rule_input(
        "Switched off",
        &audit_endpoint,
        json!(["email.received"]),
        Value::Null,
    );
    disabled_rule["is_enabled"] = json!(false);
    create_rule(app_router, &disabled_rule).await;
    create_rule(
        app_router,
        &rule_input(
            "Audit everything",
            &audit_endpoint,
            json!(["email.received"]),
            Value::Null,
        ),
    )
    .await;
}

async fn queued_endpoint_names(operation_context: &sendmock_ops::OperationContext) -> Vec<String> {
    operation_context
        .webhook_delivery_repository
        .list_due_deliveries(i64::MAX, 10)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|queued_delivery| queued_delivery.endpoint_name)
        .collect()
}

// AC: WH-02.1
// AC: WH-02.4
// AC: WH-03.1
#[tokio::test]
async fn an_email_queues_one_delivery_per_matching_enabled_rule_in_order() {
    let (app_router, operation_context) =
        build_test_app_with(|operation_context| operation_context);
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(operation_context.clone()));
    tokio::task::yield_now().await;
    create_routing_rules(&app_router).await;

    let support_email_id = send_email(&app_router, "help@support.local", "Ticket #1").await;
    let deliveries = wait_for_deliveries(&app_router, 2).await;
    send_email(&app_router, "ann@example.com", "Newsletter").await;
    let deliveries_after_newsletter = wait_for_deliveries(&app_router, 3).await;
    subscriber.abort();

    assert_eq!(
        queued_endpoint_names(&operation_context).await,
        vec!["Support desk", "Audit log", "Audit log"]
    );
    assert!(
        deliveries
            .iter()
            .all(|delivery| delivery["subject_id"] == json!(support_email_id))
    );
    assert!(
        deliveries
            .iter()
            .all(|delivery| delivery["trigger"] == "auto")
    );
    assert_eq!(deliveries_after_newsletter.len(), 3);
    assert_eq!(deliveries_after_newsletter[0]["endpoint_name"], "Audit log");
}

#[tokio::test]
async fn a_disabled_endpoint_receives_nothing() {
    let (app_router, operation_context) =
        build_test_app_with(|operation_context| operation_context);
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(operation_context.clone()));
    tokio::task::yield_now().await;
    let endpoint_id = create_endpoint(&app_router, "Paused app").await;
    call_api(
        &app_router,
        "PATCH",
        &format!("/api/v1/webhooks/endpoints/{endpoint_id}"),
        Some(&json!({ "is_enabled": false })),
    )
    .await;
    create_rule(
        &app_router,
        &rule_input(
            "All mail",
            &endpoint_id,
            json!(["email.received"]),
            Value::Null,
        ),
    )
    .await;

    send_email(&app_router, "ann@example.com", "Hello").await;
    tokio::time::sleep(Duration::from_millis(100)).await;
    let deliveries = wait_for_deliveries(&app_router, 0).await;
    subscriber.abort();

    assert!(deliveries.is_empty());
}
