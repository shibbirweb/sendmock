#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const REAL_CARD_NUMBER: &str = "4111111111111111";

async fn create_checkout(app_router: &axum::Router, provider: &str) -> String {
    let (status, payment) = call_api(
        app_router,
        "POST",
        "/api/v1/payments/checkout",
        Some(&json!({ "provider": provider, "amount_minor": 120_000, "currency": "BDT" })),
    )
    .await;
    assert_eq!(status, 201, "{payment}");
    payment["id"].as_str().unwrap_or_default().to_owned()
}

async fn complete_checkout(
    app_router: &axum::Router,
    payment_id: &str,
    checkout_request: Value,
) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        &format!("/api/v1/checkout-sessions/{payment_id}/complete"),
        Some(&checkout_request),
    )
    .await
}

async fn read_payment(app_router: &axum::Router, payment_id: &str) -> Value {
    call_api(
        app_router,
        "GET",
        &format!("/api/v1/payments/{payment_id}"),
        None,
    )
    .await
    .1
}

fn pay_with_card(card_number: &str) -> Value {
    json!({
        "action": "pay",
        "method_key": "card",
        "card": { "number": card_number, "exp_month": 12, "exp_year": 2030, "cvc": "123", "holder_name": "Sam Tester" },
    })
}

// AC: PY-01.2
#[tokio::test]
async fn paying_with_a_test_card_keeps_only_brand_last4_and_expiry() {
    let (app_router, operation_context) = build_test_app();
    let payment_id = create_checkout(&app_router, "stripe").await;

    let (status, session) = complete_checkout(
        &app_router,
        &payment_id,
        pay_with_card("4242 4242 4242 4242"),
    )
    .await;

    assert_eq!(status, 200, "{session}");
    assert_eq!(session["state"], "completed");
    assert_eq!(session["redirect"]["outcome"], "success");
    assert!(
        session["redirect"]["fields"]["session_id"]
            .as_str()
            .is_some_and(|session_id| session_id.starts_with("cs_test_"))
    );
    let payment = read_payment(&app_router, &payment_id).await;
    assert_eq!(payment["status"], "succeeded");
    assert_eq!(payment["captured_minor"], 120_000);
    assert_eq!(
        payment["method"],
        json!({ "kind": "card", "brand": "visa", "last4": "4242", "exp_month": 12, "exp_year": 2030 })
    );
    assert_eq!(payment["method_key"], "card");
    assert!(payment["checkout_url"].is_null());
    let stored_payment = operation_context
        .payment_repository
        .find_payment(&payment_id)
        .await
        .ok()
        .flatten()
        .map(|stored_payment| stored_payment.document_json)
        .unwrap_or_default();
    assert!(!stored_payment.contains("4242424242424242"));
    assert!(!stored_payment.contains("Sam Tester"));
    assert!(!stored_payment.contains("\"123\""));
}

// AC: PY-01.1
#[tokio::test]
async fn a_real_card_number_is_refused_and_appears_nowhere() {
    let (app_router, operation_context) = build_test_app();
    let payment_id = create_checkout(&app_router, "stripe").await;

    let (status, refusal) =
        complete_checkout(&app_router, &payment_id, pay_with_card(REAL_CARD_NUMBER)).await;

    assert_eq!(status, 422);
    assert_eq!(
        refusal["error"]["message"],
        "Use a test card: real card numbers are never accepted"
    );
    assert!(!refusal.to_string().contains(REAL_CARD_NUMBER));
    let payment = read_payment(&app_router, &payment_id).await;
    assert_eq!(payment["status"], "requires_payment");
    assert!(payment["method"].is_null());
    let stored_payment = operation_context
        .payment_repository
        .find_payment(&payment_id)
        .await
        .ok()
        .flatten()
        .map(|stored_payment| stored_payment.document_json)
        .unwrap_or_default();
    assert!(!stored_payment.contains(REAL_CARD_NUMBER));
    let (_, request_log) = call_api(&app_router, "GET", "/api/v1/logs/http", None).await;
    assert!(!request_log.to_string().contains(REAL_CARD_NUMBER));
    let (_, recent_events) = call_api(&app_router, "GET", "/api/v1/events/recent", None).await;
    assert!(!recent_events.to_string().contains(REAL_CARD_NUMBER));
    let (_, payment_list) = call_api(&app_router, "GET", "/api/v1/payments", None).await;
    assert!(!payment_list.to_string().contains(REAL_CARD_NUMBER));
}

#[tokio::test]
async fn a_declining_test_card_fails_and_redirects_with_the_gateway_fields() {
    let (app_router, _) = build_test_app();
    let payment_id = create_checkout(&app_router, "sslcommerz").await;

    let (status, session) =
        complete_checkout(&app_router, &payment_id, pay_with_card("4000000000000002")).await;

    assert_eq!(status, 200, "{session}");
    assert_eq!(session["state"], "failed");
    let payment_redirect = &session["redirect"];
    assert_eq!(payment_redirect["outcome"], "fail");
    assert_eq!(payment_redirect["method"], "POST");
    assert_eq!(
        payment_redirect["url"],
        "http://localhost:8000/checkout/fail"
    );
    assert_eq!(payment_redirect["fields"]["amount"], "1200.00");
    assert_eq!(payment_redirect["fields"]["currency"], "BDT");
    assert_eq!(payment_redirect["fields"]["status"], "FAILED");
    let payment = read_payment(&app_router, &payment_id).await;
    assert_eq!(payment["status"], "failed");
    assert!(payment["failure_code"].is_string());
    let (_, failed_events) = call_api(
        &app_router,
        "GET",
        "/api/v1/events/recent?type=payment.failed",
        None,
    )
    .await;
    assert_eq!(failed_events[0]["data"]["id"], payment_id.as_str());
}

#[tokio::test]
async fn a_wallet_runs_its_number_otp_and_pin_steps() {
    let (app_router, _) = build_test_app();
    let payment_id = create_checkout(&app_router, "bkash").await;
    let wallet_payment = |otp: &str| {
        json!({
            "action": "pay",
            "method_key": "bkash",
            "entries": { "number": "01770000001", "otp": otp, "pin": "12121" },
        })
    };

    let (wrong_otp_status, wrong_otp) =
        complete_checkout(&app_router, &payment_id, wallet_payment("000000")).await;
    let (status, session) =
        complete_checkout(&app_router, &payment_id, wallet_payment("123456")).await;

    assert_eq!(wrong_otp_status, 422);
    assert_eq!(
        wrong_otp["error"]["message"],
        "The verification code is wrong"
    );
    assert_eq!(status, 200, "{session}");
    assert_eq!(session["state"], "completed");
    assert_eq!(session["redirect"]["fields"]["status"], "success");
    let payment = read_payment(&app_router, &payment_id).await;
    assert_eq!(payment["method"]["kind"], "wallet");
    assert_eq!(payment["method"]["masked_number"], "01770****01");
}

#[tokio::test]
async fn three_ds_is_approved_or_failed_and_a_closed_checkout_cannot_be_paid_again() {
    let (app_router, _) = build_test_app();
    let approved_id = create_checkout(&app_router, "stripe").await;
    let failed_id = create_checkout(&app_router, "stripe").await;

    let (_, challenge) = complete_checkout(
        &app_router,
        &approved_id,
        json!({ "action": "require_three_ds" }),
    )
    .await;
    let (_, approved) = complete_checkout(
        &app_router,
        &approved_id,
        json!({ "action": "three_ds_approve" }),
    )
    .await;
    complete_checkout(
        &app_router,
        &failed_id,
        json!({ "action": "require_three_ds" }),
    )
    .await;
    let (_, failed) = complete_checkout(
        &app_router,
        &failed_id,
        json!({ "action": "three_ds_fail" }),
    )
    .await;
    let (closed_status, closed) =
        complete_checkout(&app_router, &approved_id, pay_with_card("4242424242424242")).await;

    assert_eq!(challenge["state"], "requires_three_ds");
    assert_eq!(approved["state"], "completed");
    assert_eq!(failed["state"], "failed");
    assert_eq!(failed["failure_code"], "authentication_failed");
    assert_eq!(closed_status, 409);
    assert_eq!(closed["error"]["code"], "checkout_closed");
}

#[tokio::test]
async fn cancel_delay_and_decline_give_their_outcomes() {
    let (app_router, _) = build_test_app();
    let canceled_id = create_checkout(&app_router, "native").await;
    let delayed_id = create_checkout(&app_router, "native").await;
    let declined_id = create_checkout(&app_router, "native").await;

    let (_, canceled) =
        complete_checkout(&app_router, &canceled_id, json!({ "action": "cancel" })).await;
    let (_, delayed) =
        complete_checkout(&app_router, &delayed_id, json!({ "action": "delay" })).await;
    let (_, declined) = complete_checkout(
        &app_router,
        &declined_id,
        json!({ "action": "decline", "decline_reason": "insufficient_funds" }),
    )
    .await;

    assert_eq!(canceled["state"], "canceled");
    assert_eq!(canceled["redirect"]["fields"]["outcome"], "cancel");
    assert_eq!(delayed["state"], "pending");
    assert_eq!(declined["state"], "failed");
    assert_eq!(declined["failure_code"], "insufficient_funds");
}

#[tokio::test]
async fn the_outcome_profile_settles_new_checkouts_at_once() {
    let (app_router, _) = build_test_app();
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "payment_outcome_profile": "auto_success" })),
    )
    .await;
    let succeeded_id = create_checkout(&app_router, "stripe").await;
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "payment_outcome_profile": "auto_decline" })),
    )
    .await;
    let declined_id = create_checkout(&app_router, "stripe").await;

    let succeeded = read_payment(&app_router, &succeeded_id).await;
    let declined = read_payment(&app_router, &declined_id).await;

    assert_eq!(succeeded["status"], "succeeded");
    assert_eq!(succeeded["method"]["last4"], "4242");
    assert_eq!(declined["status"], "failed");
    assert_eq!(declined["failure_code"], "generic_decline");
}
