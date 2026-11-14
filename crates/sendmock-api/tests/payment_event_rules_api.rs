#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use std::collections::BTreeSet;
use std::time::Duration;

use sendmock_ops::run_webhook_rule_subscriber;
use serde_json::{Value, json};
use support::test_app::{build_test_app_with, call_api};
use support::webhook_samples::{create_endpoint, create_rule};

const NATIVE_PAYMENT_EVENTS: [&str; 16] = [
    "payment.created",
    "payment.authorized",
    "payment.succeeded",
    "payment.failed",
    "payment.canceled",
    "payment.refunded",
    "payment.partially_refunded",
    "payment.dispute_opened",
    "payment.dispute_updated",
    "payment.dispute_closed",
    "checkout.completed",
    "checkout.expired",
    "subscription.created",
    "subscription.renewed",
    "subscription.payment_failed",
    "subscription.canceled",
];

async fn start_checkout(app_router: &axum::Router, capture_method: &str) -> String {
    let (status, payment) = call_api(
        app_router,
        "POST",
        "/api/v1/payments/checkout",
        Some(&json!({ "provider": "native", "amount_minor": 2000, "currency": "USD", "capture_method": capture_method })),
    )
    .await;
    assert_eq!(status, 201, "{payment}");
    payment["id"].as_str().unwrap_or_default().to_owned()
}

async fn pay_on_page(app_router: &axum::Router, payment_id: &str) {
    let (status, session) = call_api(
        app_router,
        "POST",
        &format!("/api/v1/checkout-sessions/{payment_id}/complete"),
        Some(&json!({ "action": "pay", "method_key": "card", "card": { "number": "4242424242424242", "exp_month": 12, "exp_year": 2030 } })),
    )
    .await;
    assert_eq!(status, 200, "{session}");
}

async fn simulate(app_router: &axum::Router, payment_id: &str, simulate_request: Value) {
    let (status, answer) = call_api(
        app_router,
        "POST",
        &format!("/api/v1/payments/{payment_id}/simulate"),
        Some(&simulate_request),
    )
    .await;
    assert_eq!(status, 200, "{simulate_request}: {answer}");
}

/// Checkouts paid, authorized and voided, declined, expired, refunded and disputed.
async fn fire_payment_events(app_router: &axum::Router) {
    let paid_id = start_checkout(app_router, "automatic").await;
    pay_on_page(app_router, &paid_id).await;
    simulate(
        app_router,
        &paid_id,
        json!({ "action": "refund", "refund_amount_minor": 500 }),
    )
    .await;
    simulate(app_router, &paid_id, json!({ "action": "dispute" })).await;
    simulate(
        app_router,
        &paid_id,
        json!({ "action": "answer_dispute", "dispute_evidence": "Receipt" }),
    )
    .await;
    simulate(
        app_router,
        &paid_id,
        json!({ "action": "resolve_dispute", "dispute_outcome": "won" }),
    )
    .await;
    simulate(app_router, &paid_id, json!({ "action": "refund" })).await;
    let authorized_id = start_checkout(app_router, "manual").await;
    pay_on_page(app_router, &authorized_id).await;
    simulate(app_router, &authorized_id, json!({ "action": "void" })).await;
    let declined_id = start_checkout(app_router, "automatic").await;
    simulate(
        app_router,
        &declined_id,
        json!({ "action": "decline", "decline_reason": "insufficient_funds" }),
    )
    .await;
    let expired_id = start_checkout(app_router, "automatic").await;
    simulate(app_router, &expired_id, json!({ "action": "expire" })).await;
}

/// A subscription renewed and canceled, and one whose card declines.
async fn fire_subscription_events(app_router: &axum::Router) {
    let subscription_body = |card_number: &str| {
        json!({ "provider": "native", "customer_email": "sam@example.test", "plan_name": "Pro",
                "amount_minor": 1500, "interval": "month", "card_number": card_number })
    };
    let (_, renewed) = call_api(
        app_router,
        "POST",
        "/api/v1/payments/subscriptions",
        Some(&subscription_body("4242424242424242")),
    )
    .await;
    call_api(
        app_router,
        "POST",
        "/api/v1/payments/subscriptions",
        Some(&subscription_body("4000000000000002")),
    )
    .await;
    let renewed_id = renewed["id"].as_str().unwrap_or_default();
    let (status, canceled) = call_api(
        app_router,
        "POST",
        &format!("/api/v1/payments/subscriptions/{renewed_id}/cancel"),
        Some(&json!({})),
    )
    .await;
    assert_eq!(status, 200, "{canceled}");
}

// AC: PY-08.1
#[tokio::test]
async fn every_native_payment_checkout_and_subscription_event_triggers_a_webhook_rule() {
    let (app_router, operation_context) =
        build_test_app_with(|operation_context| operation_context);
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(operation_context.clone()));
    tokio::task::yield_now().await;
    let endpoint_id = create_endpoint(&app_router, "Payment events").await;
    let rule_events: BTreeSet<&str> = NATIVE_PAYMENT_EVENTS.into_iter().collect();
    create_rule(&app_router, &json!({ "name": "Every payment event", "endpoint_id": endpoint_id, "events": rule_events, "is_enabled": true })).await;

    fire_payment_events(&app_router).await;
    fire_subscription_events(&app_router).await;
    tokio::time::sleep(Duration::from_millis(300)).await;
    subscriber.abort();

    let (_, deliveries) = call_api(
        &app_router,
        "GET",
        "/api/v1/webhooks/deliveries?limit=200",
        None,
    )
    .await;
    let delivered_events: BTreeSet<String> = deliveries["items"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|delivery| delivery["event_type"].as_str().map(str::to_owned))
        .collect();
    let missing_events: Vec<&&str> = rule_events
        .iter()
        .filter(|event_type| !delivered_events.contains(**event_type))
        .collect();
    assert!(
        missing_events.is_empty(),
        "missing {missing_events:?}, got {delivered_events:?}"
    );
}
