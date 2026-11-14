#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

async fn create_checkout(app_router: &axum::Router, checkout_request: Value) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        "/api/v1/payments/checkout",
        Some(&checkout_request),
    )
    .await
}

// AC: PY-02.2
// AC: PY-12.3
#[tokio::test]
async fn a_checkout_is_created_on_any_gateway_and_waits_on_its_page() {
    let (app_router, _) = build_test_app();

    let (status, payment) = create_checkout(
        &app_router,
        json!({ "provider": "sslcommerz", "amount_minor": 120_000, "currency": "bdt", "customer_email": "ruma@example.com" }),
    )
    .await;

    assert_eq!(status, 201, "{payment}");
    assert_eq!(payment["status"], "requires_payment");
    assert_eq!(payment["currency"], "BDT");
    assert_eq!(payment["provider_name"], "SSLCommerz");
    assert!(
        payment["provider_reference"]
            .as_str()
            .is_some_and(|reference| reference.starts_with("TXN"))
    );
    assert!(
        payment["provider_ids"]["val_id"]
            .as_str()
            .is_some_and(|val_id| val_id.starts_with("VAL"))
    );
    let payment_id = payment["id"].as_str().unwrap_or_default();
    assert_eq!(
        payment["checkout_url"],
        format!("http://127.0.0.1:8025/pay/{payment_id}")
    );
    assert_eq!(payment["line_items"][0]["unit_amount_minor"], 120_000);
    assert_eq!(payment["timeline"][0]["kind"], "created");
    let (_, recent_events) = call_api(
        &app_router,
        "GET",
        "/api/v1/events/recent?type=payment.created",
        None,
    )
    .await;
    assert_eq!(recent_events[0]["data"]["id"], payment["id"]);
}

// AC: PY-02.3
#[tokio::test]
async fn the_default_currency_applies_and_amounts_stay_in_minor_units() {
    let (app_router, _) = build_test_app();
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "payment_default_currency": "JPY" })),
    )
    .await;

    let (_, yen_payment) = create_checkout(
        &app_router,
        json!({ "provider": "stripe", "amount_minor": 500 }),
    )
    .await;
    let (zero_status, _) = create_checkout(
        &app_router,
        json!({ "provider": "stripe", "amount_minor": 0 }),
    )
    .await;
    let (currency_status, currency_answer) = create_checkout(
        &app_router,
        json!({ "provider": "stripe", "amount_minor": 100, "currency": "EURO" }),
    )
    .await;
    let (gateway_status, gateway_answer) = create_checkout(
        &app_router,
        json!({ "provider": "nowhere", "amount_minor": 100 }),
    )
    .await;

    assert_eq!(yen_payment["currency"], "JPY");
    assert_eq!(yen_payment["amount_minor"], 500);
    assert_eq!(zero_status, 400);
    assert_eq!(currency_status, 400);
    assert_eq!(currency_answer["error"]["field"], "currency");
    assert_eq!(gateway_status, 400);
    assert_eq!(gateway_answer["error"]["field"], "provider");
}

// AC: PY-09.1
#[tokio::test]
async fn payments_are_listed_newest_first_with_filters_and_count_on_their_gateway() {
    let (app_router, _) = build_test_app();
    for (provider, currency) in [("stripe", "USD"), ("sslcommerz", "BDT"), ("stripe", "EUR")] {
        create_checkout(
            &app_router,
            json!({ "provider": provider, "amount_minor": 1000, "currency": currency }),
        )
        .await;
    }

    let (_, all_payments) = call_api(&app_router, "GET", "/api/v1/payments?limit=2", None).await;
    let (_, stripe_payments) = call_api(
        &app_router,
        "GET",
        "/api/v1/payments?provider=stripe&currency=eur",
        None,
    )
    .await;
    let (_, waiting) = call_api(
        &app_router,
        "GET",
        "/api/v1/payments?status=requires_payment,succeeded",
        None,
    )
    .await;
    let (_, stripe_gateway) =
        call_api(&app_router, "GET", "/api/v1/payments/gateways/stripe", None).await;

    assert_eq!(all_payments["total_count"], 3);
    assert_eq!(all_payments["items"].as_array().map(Vec::len), Some(2));
    assert!(all_payments["next_cursor"].is_string());
    assert_eq!(stripe_payments["total_count"], 1);
    assert_eq!(waiting["total_count"], 3);
    assert_eq!(stripe_gateway["payment_count"], 2);
}

// AC: PY-12.3
#[tokio::test]
async fn the_checkout_session_shows_the_gateways_methods_and_their_flows() {
    let (app_router, _) = build_test_app();
    let (_, payment) = create_checkout(
        &app_router,
        json!({ "provider": "sslcommerz", "amount_minor": 5000 }),
    )
    .await;
    let session_path = format!(
        "/api/v1/checkout-sessions/{}",
        payment["id"].as_str().unwrap_or_default()
    );

    let (status, session) = call_api(&app_router, "GET", &session_path, None).await;
    let (missing_status, _) = call_api(
        &app_router,
        "GET",
        "/api/v1/checkout-sessions/01MISSING",
        None,
    )
    .await;

    assert_eq!(status, 200, "{session}");
    assert_eq!(session["state"], "open");
    assert!(
        session["merchant_name"]
            .as_str()
            .is_some_and(|merchant_name| !merchant_name.is_empty())
    );
    let method_keys: Vec<&str> = session["methods"]
        .as_array()
        .map(|methods| {
            methods
                .iter()
                .filter_map(|method| method["key"].as_str())
                .collect()
        })
        .unwrap_or_default();
    assert_eq!(method_keys.first(), Some(&"card"));
    assert!(method_keys.contains(&"bkash"));
    let flow_keys: Vec<&str> = session["flows"]
        .as_array()
        .map(|flows| {
            flows
                .iter()
                .filter_map(|flow| flow["key"].as_str())
                .collect()
        })
        .unwrap_or_default();
    assert!(flow_keys.contains(&"card") && flow_keys.contains(&"wallet"));
    assert_eq!(missing_status, 404);
}

#[tokio::test]
async fn test_values_list_the_enabled_methods_and_reset_deletes_payments() {
    let (app_router, _) = build_test_app();
    create_checkout(
        &app_router,
        json!({ "provider": "native", "amount_minor": 100 }),
    )
    .await;

    let (_, test_values) = call_api(&app_router, "GET", "/api/v1/payments/test-cards", None).await;
    call_api(&app_router, "POST", "/api/v1/reset", None).await;
    let (_, payments_after_reset) = call_api(&app_router, "GET", "/api/v1/payments", None).await;

    assert_eq!(test_values[0]["key"], "card");
    assert_eq!(
        test_values[0]["test_cards"][0]["number"],
        "4242424242424242"
    );
    assert_eq!(payments_after_reset["total_count"], 0);
}
