#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const PAYMENTS_PATH: &str = "/api/v1/payments";

/// Pays a Stripe payment of 19.99 USD with the card, after the given field changes.
async fn create_payment(
    app_router: &axum::Router,
    card_number: &str,
    changed_fields: &Value,
) -> (u16, Value) {
    let mut create_fields = json!({
        "provider": "stripe", "amount_minor": 1999, "currency": "USD", "card_number": card_number,
    });
    if let (Some(fields), Some(changes)) =
        (create_fields.as_object_mut(), changed_fields.as_object())
    {
        fields.extend(changes.clone());
    }
    call_api(app_router, "POST", PAYMENTS_PATH, Some(&create_fields)).await
}

async fn count_payments(app_router: &axum::Router) -> usize {
    let (_, payment_page) = call_api(app_router, "GET", PAYMENTS_PATH, None).await;
    payment_page["items"].as_array().map_or(0, Vec::len)
}

// AC: PY-02.1
#[tokio::test]
async fn a_test_card_decides_the_payment_and_the_payment_is_stored() {
    let (app_router, _) = build_test_app();

    let (paid_status, paid) = create_payment(&app_router, "4242 4242 4242 4242", &json!({})).await;
    let (declined_status, declined) =
        create_payment(&app_router, "4000000000009995", &json!({})).await;
    let (three_ds_status, three_ds) =
        create_payment(&app_router, "4000002500003155", &json!({})).await;
    let (_, authorized) = create_payment(
        &app_router,
        "4242424242424242",
        &json!({ "capture_method": "manual" }),
    )
    .await;

    assert_eq!(
        (paid_status, declined_status, three_ds_status),
        (201, 201, 201),
        "{declined}"
    );
    assert_eq!(paid["status"], "succeeded", "{paid}");
    assert_eq!(paid["checkout_url"], Value::Null);
    assert_eq!(declined["status"], "failed");
    assert_eq!(declined["failure_code"], "insufficient_funds");
    assert_eq!(three_ds["failure_code"], "authentication_failed");
    assert_eq!(authorized["status"], "authorized");
    let (_, stored) = call_api(
        &app_router,
        "GET",
        &format!(
            "{PAYMENTS_PATH}/{}",
            paid["id"].as_str().unwrap_or_default()
        ),
        None,
    )
    .await;
    assert_eq!(stored["status"], "succeeded");
}

// AC: PY-02.1
#[tokio::test]
async fn a_real_card_or_an_unknown_gateway_is_refused_and_nothing_is_stored() {
    let (app_router, _) = build_test_app();

    let (real_card_status, _) = create_payment(&app_router, "4111111111111111", &json!({})).await;
    let (gateway_status, _) = create_payment(
        &app_router,
        "4242424242424242",
        &json!({ "provider": "nope" }),
    )
    .await;

    assert_eq!((real_card_status, gateway_status), (422, 404));
    assert_eq!(count_payments(&app_router).await, 0);
}

// AC: PY-02.3
#[tokio::test]
async fn amounts_stay_in_minor_units_for_every_currency() {
    let (app_router, _) = build_test_app();
    let currency_amounts = [
        ("BDT", 150_000),
        ("INR", 49_900),
        ("USD", 1999),
        ("EUR", 1250),
        ("jpy", 1500),
    ];

    let mut stored_amounts = Vec::new();
    for (currency, amount_minor) in currency_amounts {
        let (status, payment) = create_payment(
            &app_router,
            "4242424242424242",
            &json!({ "currency": currency, "amount_minor": amount_minor }),
        )
        .await;
        assert_eq!(status, 201, "{payment}");
        stored_amounts.push((payment["currency"].clone(), payment["amount_minor"].clone()));
    }
    let (bad_currency_status, _) = create_payment(
        &app_router,
        "4242424242424242",
        &json!({ "currency": "US" }),
    )
    .await;

    assert_eq!(
        stored_amounts,
        [
            (json!("BDT"), json!(150_000)),
            (json!("INR"), json!(49_900)),
            (json!("USD"), json!(1999)),
            (json!("EUR"), json!(1250)),
            (json!("JPY"), json!(1500)),
        ]
    );
    assert_eq!(bad_currency_status, 400);
}
