#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod stripe_requests;
    pub mod test_app;
}

use serde_json::json;
use support::stripe_requests::{StripeReply, call_stripe, find_payment, read_text};
use support::test_app::{build_test_app, call_api};

const SESSION_FORM: &str = "mode=payment\
    &success_url=https://shop.test/thanks?session_id={CHECKOUT_SESSION_ID}\
    &cancel_url=https://shop.test/cart\
    &client_reference_id=order-7&customer_email=buyer@example.test&metadata[order_id]=7\
    &line_items[0][quantity]=2&line_items[0][price_data][currency]=usd\
    &line_items[0][price_data][unit_amount]=1500&line_items[0][price_data][product_data][name]=T-shirt\
    &line_items[1][quantity]=1&line_items[1][price_data][currency]=usd\
    &line_items[1][price_data][unit_amount]=500&line_items[1][price_data][product_data][name]=Mug";

async fn create_session(app_router: &axum::Router, extra_form: &str) -> StripeReply {
    call_stripe(
        app_router,
        "POST",
        "/checkout/sessions",
        &format!("{SESSION_FORM}&{extra_form}"),
    )
    .await
}

/// Pays on the checkout page with a test card, as the customer would.
async fn pay_on_page(app_router: &axum::Router, session: &StripeReply, card_number: &str) {
    let checkout_url = read_text(&session.body["url"]);
    let payment_id = checkout_url.rsplit('/').next().unwrap_or_default();
    let (status, answer) = call_api(
        app_router,
        "POST",
        &format!("/api/v1/checkout-sessions/{payment_id}/complete"),
        Some(&json!({"action": "pay", "card": {"number": card_number, "exp_month": 12, "exp_year": 2034}})),
    )
    .await;
    assert_eq!(status, 200, "{answer}");
}

// AC: PY-04.1
#[tokio::test]
async fn creates_an_open_checkout_session_on_this_instances_page() {
    let (app_router, _) = build_test_app();

    let session = create_session(&app_router, "").await;
    let session_id = read_text(&session.body["id"]);

    assert_eq!(session.status, 200, "{}", session.body);
    assert!(session_id.starts_with("cs_test_"));
    assert_eq!(session.body["object"], "checkout.session");
    assert_eq!(session.body["status"], "open");
    assert_eq!(session.body["payment_status"], "unpaid");
    assert_eq!(session.body["amount_total"], 3500);
    assert_eq!(session.body["currency"], "usd");
    assert_eq!(session.body["client_reference_id"], "order-7");
    assert_eq!(session.body["payment_intent"], json!(null));
    assert_eq!(
        session.body["success_url"],
        format!("https://shop.test/thanks?session_id={session_id}")
    );
    assert!(read_text(&session.body["url"]).starts_with("http://127.0.0.1:8025/pay/"));
    let payment = find_payment(&app_router, &session_id).await;
    assert_eq!(payment["amount_minor"], 3500);
    assert_eq!(payment["line_items"][0]["name"], "T-shirt");
    assert_eq!(payment["metadata"], json!({"order_id": "7"}));
}

// AC: PY-04.1
#[tokio::test]
async fn a_session_paid_on_its_page_is_complete_with_its_payment_intent() {
    let (app_router, _) = build_test_app();
    let session = create_session(
        &app_router,
        "payment_intent_data[metadata][shipment]=express",
    )
    .await;
    let session_id = read_text(&session.body["id"]);

    pay_on_page(&app_router, &session, "4242424242424242").await;
    let completed = call_stripe(
        &app_router,
        "GET",
        &format!("/checkout/sessions/{session_id}"),
        "",
    )
    .await;
    let intent_id = read_text(&completed.body["payment_intent"]);
    let payment_intent = call_stripe(
        &app_router,
        "GET",
        &format!("/payment_intents/{intent_id}"),
        "",
    )
    .await;
    let line_items = call_stripe(
        &app_router,
        "GET",
        &format!("/checkout/sessions/{session_id}/line_items"),
        "",
    )
    .await;

    assert_eq!(completed.body["status"], "complete");
    assert_eq!(completed.body["payment_status"], "paid");
    assert_eq!(completed.body["url"], json!(null));
    assert_eq!(
        completed.body["customer_details"]["email"],
        "buyer@example.test"
    );
    assert_eq!(payment_intent.body["status"], "succeeded");
    assert_eq!(payment_intent.body["amount_received"], 3500);
    assert_eq!(
        payment_intent.body["metadata"],
        json!({"shipment": "express"})
    );
    assert_eq!(line_items.body["object"], "list");
    assert_eq!(line_items.body["data"][0]["description"], "T-shirt");
    assert_eq!(line_items.body["data"][0]["amount_total"], 3000);
    assert_eq!(line_items.body["data"][1]["quantity"], 1);
}

// AC: PY-04.1, PY-07.1
#[tokio::test]
async fn a_manual_capture_session_completes_unpaid_until_captured() {
    let (app_router, _) = build_test_app();
    let session = create_session(&app_router, "payment_intent_data[capture_method]=manual").await;
    let session_id = read_text(&session.body["id"]);

    pay_on_page(&app_router, &session, "4242424242424242").await;
    let completed = call_stripe(
        &app_router,
        "GET",
        &format!("/checkout/sessions/{session_id}"),
        "",
    )
    .await;
    let intent_id = read_text(&completed.body["payment_intent"]);
    let captured = call_stripe(
        &app_router,
        "POST",
        &format!("/payment_intents/{intent_id}/capture"),
        "",
    )
    .await;

    assert_eq!(completed.body["status"], "complete");
    assert_eq!(completed.body["payment_status"], "unpaid");
    assert_eq!(captured.body["status"], "succeeded", "{}", captured.body);
    let payment = find_payment(&app_router, &session_id).await;
    assert_eq!(payment["status"], "succeeded");
    assert_eq!(payment["captured_minor"], 3500);
}

// AC: PY-04.1
#[tokio::test]
async fn expires_an_open_session_and_refuses_a_second_expiry() {
    let (app_router, _) = build_test_app();
    let session = create_session(&app_router, "").await;
    let session_id = read_text(&session.body["id"]);

    let expired = call_stripe(
        &app_router,
        "POST",
        &format!("/checkout/sessions/{session_id}/expire"),
        "",
    )
    .await;
    let expired_again = call_stripe(
        &app_router,
        "POST",
        &format!("/checkout/sessions/{session_id}/expire"),
        "",
    )
    .await;

    assert_eq!(expired.body["status"], "expired", "{}", expired.body);
    assert_eq!(expired.body["url"], json!(null));
    assert_eq!(expired_again.status, 400);
    let payment = find_payment(&app_router, &session_id).await;
    assert_eq!(payment["failure_code"], "expired");
}

// AC: PY-04.1
#[tokio::test]
async fn refuses_sessions_stripe_would_refuse() {
    let (app_router, _) = build_test_app();

    let no_mode = call_stripe(
        &app_router,
        "POST",
        "/checkout/sessions",
        "success_url=https://shop.test",
    )
    .await;
    let subscription = call_stripe(
        &app_router,
        "POST",
        "/checkout/sessions",
        "mode=subscription",
    )
    .await;
    let price_id = call_stripe(
        &app_router,
        "POST",
        "/checkout/sessions",
        "mode=payment&line_items[0][price]=price_123&line_items[0][quantity]=1",
    )
    .await;
    let unknown = call_stripe(&app_router, "GET", "/checkout/sessions/cs_test_missing", "").await;

    assert_eq!(no_mode.body["error"]["param"], "mode");
    assert_eq!(subscription.status, 400);
    assert_eq!(price_id.body["error"]["code"], "resource_missing");
    assert_eq!(price_id.body["error"]["param"], "line_items[0][price]");
    assert_eq!(unknown.status, 404);
    assert_eq!(
        unknown.body["error"]["message"],
        "No such checkout.session: 'cs_test_missing'"
    );
}
