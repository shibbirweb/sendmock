#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use sendmock_ops::OperationContext;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use support::webhook_samples::create_endpoint;

/// An app whose new checkouts settle at once, with Stripe notifying "Shop payments".
async fn build_paid_app() -> (axum::Router, OperationContext) {
    let (app_router, operation_context) = build_test_app();
    let endpoint_id = create_endpoint(&app_router, "Shop payments").await;
    let (_, mut stripe_gateway) =
        call_api(&app_router, "GET", "/api/v1/payments/gateways/stripe", None).await;
    stripe_gateway["notification_endpoint_id"] = json!(endpoint_id);
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/payments/gateways/stripe",
        Some(&stripe_gateway),
    )
    .await;
    (app_router, operation_context)
}

async fn set_outcome_profile(app_router: &axum::Router, outcome_profile: &str) {
    let (status, _) = call_api(
        app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "payment_outcome_profile": outcome_profile })),
    )
    .await;
    assert_eq!(status, 200);
}

async fn create_checkout(app_router: &axum::Router) -> String {
    let (status, payment) = call_api(
        app_router,
        "POST",
        "/api/v1/payments/checkout",
        Some(&json!({ "provider": "stripe", "amount_minor": 2000, "currency": "USD" })),
    )
    .await;
    assert_eq!(status, 201, "{payment}");
    payment["id"].as_str().unwrap_or_default().to_owned()
}

async fn create_manual_checkout(app_router: &axum::Router) -> String {
    let (status, payment) = call_api(
        app_router,
        "POST",
        "/api/v1/payments/checkout",
        Some(&json!({
            "provider": "stripe",
            "amount_minor": 2000,
            "currency": "USD",
            "capture_method": "manual",
        })),
    )
    .await;
    assert_eq!(status, 201, "{payment}");
    assert_eq!(payment["capture_method"], "manual");
    payment["id"].as_str().unwrap_or_default().to_owned()
}

async fn simulate(app_router: &axum::Router, payment_id: &str, request: Value) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        &format!("/api/v1/payments/{payment_id}/simulate"),
        Some(&request),
    )
    .await
}

fn last_provider_event_name(payment: &Value) -> Value {
    payment["notifications"]
        .as_array()
        .and_then(|notifications| notifications.last())
        .map(|notification| notification["provider_event_name"].clone())
        .unwrap_or(Value::Null)
}

// AC: PY-07.2, PY-09.3
#[tokio::test]
async fn partial_and_full_refunds_update_the_payment_and_send_the_providers_refund_event() {
    let (app_router, _) = build_paid_app().await;
    set_outcome_profile(&app_router, "auto_success").await;
    let payment_id = create_checkout(&app_router).await;

    let (partial_status, partially_refunded) = simulate(
        &app_router,
        &payment_id,
        json!({ "action": "refund", "refund_amount_minor": 500 }),
    )
    .await;
    let (too_much_status, too_much) = simulate(
        &app_router,
        &payment_id,
        json!({ "action": "refund", "refund_amount_minor": 1600 }),
    )
    .await;
    let (_, refunded) = simulate(&app_router, &payment_id, json!({ "action": "refund" })).await;
    let (again_status, again) =
        simulate(&app_router, &payment_id, json!({ "action": "refund" })).await;

    assert_eq!(partial_status, 200, "{partially_refunded}");
    assert_eq!(partially_refunded["status"], "partially_refunded");
    assert_eq!(partially_refunded["refunded_minor"], 500);
    assert_eq!(
        last_provider_event_name(&partially_refunded),
        "charge.refunded"
    );
    assert_eq!(too_much_status, 422);
    assert_eq!(
        too_much["error"]["message"],
        "That is more than is left to refund"
    );
    assert_eq!(refunded["status"], "refunded");
    assert_eq!(refunded["refunded_minor"], 2000);
    assert_eq!(last_provider_event_name(&refunded), "charge.refunded");
    assert_eq!(again_status, 409);
    assert_eq!(again["error"]["code"], "action_not_allowed");
    let (_, refund_events) = call_api(
        &app_router,
        "GET",
        "/api/v1/events/recent?type=payment.partially_refunded",
        None,
    )
    .await;
    assert_eq!(refund_events[0]["data"]["id"], payment_id.as_str());
}

// AC: PY-07.3, PY-09.3
#[tokio::test]
async fn a_dispute_opens_and_is_won_or_lost_with_the_providers_events() {
    let (app_router, _) = build_paid_app().await;
    set_outcome_profile(&app_router, "auto_success").await;
    let won_id = create_checkout(&app_router).await;
    let lost_id = create_checkout(&app_router).await;

    let (_, opened) = simulate(&app_router, &won_id, json!({ "action": "dispute" })).await;
    let (_, won) = simulate(
        &app_router,
        &won_id,
        json!({ "action": "resolve_dispute", "dispute_outcome": "won" }),
    )
    .await;
    simulate(&app_router, &lost_id, json!({ "action": "dispute" })).await;
    let (_, lost) = simulate(
        &app_router,
        &lost_id,
        json!({ "action": "resolve_dispute", "dispute_outcome": "lost" }),
    )
    .await;

    assert_eq!(opened["status"], "disputed");
    assert_eq!(opened["dispute"]["status"], "needs_response");
    assert_eq!(last_provider_event_name(&opened), "charge.dispute.created");
    assert_eq!(won["status"], "succeeded");
    assert_eq!(won["dispute"]["status"], "won");
    assert_eq!(last_provider_event_name(&won), "charge.dispute.closed");
    assert_eq!(lost["status"], "refunded");
    assert_eq!(lost["refunded_minor"], 2000);
}

// AC: PY-07.1, PY-09.3
#[tokio::test]
async fn a_manual_capture_payment_is_authorized_then_captured_or_voided() {
    let (app_router, _) = build_paid_app().await;
    let captured_id = create_manual_checkout(&app_router).await;
    let voided_id = create_manual_checkout(&app_router).await;

    let (_, authorized) = simulate(&app_router, &captured_id, json!({ "action": "succeed" })).await;
    simulate(&app_router, &voided_id, json!({ "action": "succeed" })).await;
    let (refund_status, _) =
        simulate(&app_router, &captured_id, json!({ "action": "refund" })).await;
    let (_, captured) = simulate(&app_router, &captured_id, json!({ "action": "capture" })).await;
    let (_, voided) = simulate(&app_router, &voided_id, json!({ "action": "void" })).await;

    assert_eq!(authorized["status"], "authorized");
    assert_eq!(authorized["captured_minor"], 0);
    assert_eq!(
        last_provider_event_name(&authorized),
        "payment_intent.amount_capturable_updated"
    );
    assert_eq!(refund_status, 409);
    assert_eq!(captured["status"], "succeeded");
    assert_eq!(captured["captured_minor"], 2000);
    assert_eq!(
        last_provider_event_name(&captured),
        "payment_intent.succeeded"
    );
    assert!(captured["timeline"].as_array().is_some_and(|timeline| {
        timeline
            .iter()
            .any(|timeline_event| timeline_event["kind"] == "captured")
    }));
    assert_eq!(voided["status"], "canceled");
    assert_eq!(last_provider_event_name(&voided), "payment_intent.canceled");
}

// AC: PY-03.3, PY-09.3
#[tokio::test]
async fn an_expired_checkout_says_so_and_cannot_be_paid() {
    let (app_router, _) = build_paid_app().await;
    let payment_id = create_checkout(&app_router).await;

    let (status, expired) = simulate(&app_router, &payment_id, json!({ "action": "expire" })).await;
    let (_, session) = call_api(
        &app_router,
        "GET",
        &format!("/api/v1/checkout-sessions/{payment_id}"),
        None,
    )
    .await;
    let (pay_status, refusal) = call_api(
        &app_router,
        "POST",
        &format!("/api/v1/checkout-sessions/{payment_id}/complete"),
        Some(&json!({ "action": "pay", "method_key": "card" })),
    )
    .await;

    assert_eq!(status, 200, "{expired}");
    assert_eq!(expired["status"], "canceled");
    assert_eq!(expired["failure_code"], "expired");
    assert!(expired["checkout_url"].is_null());
    assert_eq!(
        last_provider_event_name(&expired),
        "checkout.session.expired"
    );
    assert_eq!(session["state"], "expired");
    assert_eq!(pay_status, 409);
    assert_eq!(refusal["error"]["code"], "checkout_closed");
}

// AC: PY-09.3
#[tokio::test]
async fn simulate_succeeds_or_declines_an_open_payment_and_refuses_unknown_ones() {
    let (app_router, _) = build_paid_app().await;
    let succeeded_id = create_checkout(&app_router).await;
    let declined_id = create_checkout(&app_router).await;

    let (_, succeeded) = simulate(&app_router, &succeeded_id, json!({ "action": "succeed" })).await;
    let (_, declined) = simulate(
        &app_router,
        &declined_id,
        json!({ "action": "decline", "decline_reason": "insufficient_funds" }),
    )
    .await;
    let (capture_status, refusal) =
        simulate(&app_router, &succeeded_id, json!({ "action": "capture" })).await;
    let (missing_status, _) = simulate(
        &app_router,
        "01JB7T9Q2R5W8X3Y6Z1A4B7C9D",
        json!({ "action": "succeed" }),
    )
    .await;

    assert_eq!(succeeded["status"], "succeeded");
    assert_eq!(succeeded["redirect"]["outcome"], "success");
    assert_eq!(declined["status"], "failed");
    assert_eq!(declined["failure_code"], "insufficient_funds");
    assert_eq!(
        last_provider_event_name(&declined),
        "payment_intent.payment_failed"
    );
    assert_eq!(capture_status, 409);
    assert_eq!(
        refusal["error"]["message"],
        "A succeeded payment cannot do capture"
    );
    assert_eq!(missing_status, 404);
}
