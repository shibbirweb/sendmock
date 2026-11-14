#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod stripe_requests;
    pub mod test_app;
}

use serde_json::json;
use support::stripe_requests::{call_stripe, create_payment_intent, find_payment, read_text};
use support::test_app::build_test_app;

async fn create_paid_intent(app_router: &axum::Router) -> String {
    let paid = create_payment_intent(app_router, "confirm=true&payment_method=pm_card_visa").await;
    assert_eq!(paid.status, 200, "{}", paid.body);
    read_text(&paid.body["id"])
}

// AC: PY-04.1
#[tokio::test]
async fn refunds_part_then_the_rest_and_retrieves_each_refund() {
    let (app_router, _) = build_test_app();
    let intent_id = create_paid_intent(&app_router).await;

    let partial = call_stripe(
        &app_router,
        "POST",
        "/refunds",
        &format!(
            "payment_intent={intent_id}&amount=500&reason=requested_by_customer&metadata[ticket]=9"
        ),
    )
    .await;
    let partial_payment = find_payment(&app_router, &intent_id).await;
    let charge_id = intent_id.replacen("pi_", "ch_", 1);
    let rest = call_stripe(
        &app_router,
        "POST",
        "/refunds",
        &format!("charge={charge_id}"),
    )
    .await;
    let retrieved = call_stripe(
        &app_router,
        "GET",
        &format!("/refunds/{}", read_text(&partial.body["id"])),
        "",
    )
    .await;

    assert_eq!(partial.status, 200, "{}", partial.body);
    assert!(read_text(&partial.body["id"]).starts_with("re_"));
    assert_eq!(partial.body["object"], "refund");
    assert_eq!(partial.body["amount"], 500);
    assert_eq!(partial.body["status"], "succeeded");
    assert_eq!(partial.body["charge"], charge_id);
    assert_eq!(partial.body["payment_intent"], intent_id);
    assert_eq!(partial.body["metadata"], json!({"ticket": "9"}));
    assert_eq!(partial_payment["status"], "partially_refunded");
    assert_eq!(rest.body["amount"], 1500, "{}", rest.body);
    assert_eq!(retrieved.body, partial.body);
    let refunded_payment = find_payment(&app_router, &intent_id).await;
    assert_eq!(refunded_payment["status"], "refunded");
    assert_eq!(refunded_payment["refunded_minor"], 2000);
}

// AC: PY-04.1
#[tokio::test]
async fn refuses_refunds_stripe_would_refuse() {
    let (app_router, _) = build_test_app();
    let intent_id = create_paid_intent(&app_router).await;
    let unpaid = create_payment_intent(&app_router, "").await;

    let too_much = call_stripe(
        &app_router,
        "POST",
        "/refunds",
        &format!("payment_intent={intent_id}&amount=2500"),
    )
    .await;
    let unpaid_refund = call_stripe(
        &app_router,
        "POST",
        "/refunds",
        &format!("payment_intent={}", read_text(&unpaid.body["id"])),
    )
    .await;
    call_stripe(
        &app_router,
        "POST",
        "/refunds",
        &format!("payment_intent={intent_id}"),
    )
    .await;
    let refunded_again = call_stripe(
        &app_router,
        "POST",
        "/refunds",
        &format!("payment_intent={intent_id}"),
    )
    .await;
    let nothing_named = call_stripe(&app_router, "POST", "/refunds", "amount=100").await;
    let unknown_refund = call_stripe(&app_router, "GET", "/refunds/re_missing", "").await;

    assert_eq!(too_much.status, 400);
    assert_eq!(too_much.body["error"]["code"], "amount_too_large");
    assert_eq!(
        too_much.body["error"]["message"],
        "Refund amount (25.00 USD) is greater than unrefunded amount on charge (20.00 USD)"
    );
    assert_eq!(unpaid_refund.status, 400);
    assert_eq!(
        refunded_again.body["error"]["code"],
        "charge_already_refunded"
    );
    assert_eq!(nothing_named.body["error"]["code"], "parameter_missing");
    assert_eq!(unknown_refund.status, 404);
}
