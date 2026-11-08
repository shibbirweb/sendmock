#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const GATEWAYS_PATH: &str = "/api/v1/payments/gateways";

async fn get_gateway(app_router: &axum::Router, gateway_key: &str) -> Value {
    let (status, payment_gateway) = call_api(
        app_router,
        "GET",
        &format!("{GATEWAYS_PATH}/{gateway_key}"),
        None,
    )
    .await;
    assert_eq!(status, 200, "{payment_gateway}");
    payment_gateway
}

/// A gateway answer as a change body: the answer's own fields without what the server adds.
fn to_gateway_input(mut payment_gateway: Value) -> Value {
    if let Some(fields) = payment_gateway.as_object_mut() {
        for read_only_field in ["is_builtin", "is_modified", "payment_count"] {
            fields.remove(read_only_field);
        }
    }
    payment_gateway
}

// AC: PY-12.2
#[tokio::test]
async fn lists_the_built_in_gateways_with_secrets_masked() {
    let (app_router, _) = build_test_app();

    let (status, payment_gateways) = call_api(&app_router, "GET", GATEWAYS_PATH, None).await;

    assert_eq!(status, 200);
    let gateway_keys: Vec<&str> = payment_gateways
        .as_array()
        .map(|gateways| {
            gateways
                .iter()
                .filter_map(|gateway| gateway["key"].as_str())
                .collect()
        })
        .unwrap_or_default();
    assert_eq!(
        gateway_keys,
        [
            "stripe",
            "paypal",
            "sslcommerz",
            "bkash",
            "razorpay",
            "paddle",
            "native"
        ]
    );
    for payment_gateway in payment_gateways.as_array().into_iter().flatten() {
        for credential in payment_gateway["credentials"]
            .as_array()
            .into_iter()
            .flatten()
        {
            if credential["is_secret"] == true {
                assert!(
                    credential["value"]
                        .as_str()
                        .is_some_and(|value| value.starts_with("••••")),
                    "{credential}"
                );
            }
        }
    }
}

// AC: PY-12.2
#[tokio::test]
async fn a_custom_gateway_starts_from_a_built_in_or_blank_and_can_be_deleted() {
    let (app_router, _) = build_test_app();

    let (copy_status, copied) = call_api(
        &app_router,
        "POST",
        GATEWAYS_PATH,
        Some(&json!({ "name": "Nagad", "key": "nagad", "start_from": "sslcommerz" })),
    )
    .await;
    let (blank_status, blank) = call_api(
        &app_router,
        "POST",
        GATEWAYS_PATH,
        Some(&json!({ "name": "Upay", "key": "upay", "start_from": null })),
    )
    .await;
    let (taken_status, taken_answer) = call_api(
        &app_router,
        "POST",
        GATEWAYS_PATH,
        Some(&json!({ "name": "Stripe again", "key": "stripe", "start_from": null })),
    )
    .await;
    let (delete_status, _) = call_api(
        &app_router,
        "DELETE",
        &format!("{GATEWAYS_PATH}/upay"),
        None,
    )
    .await;

    assert_eq!(copy_status, 201, "{copied}");
    assert_eq!(copied["is_builtin"], false);
    assert_eq!(
        copied["method_keys"],
        get_gateway(&app_router, "sslcommerz").await["method_keys"]
    );
    assert_eq!(blank_status, 201, "{blank}");
    assert_eq!(blank["method_keys"], json!(["card"]));
    assert_eq!(taken_status, 400);
    assert_eq!(taken_answer["error"]["field"], "key");
    assert_eq!(delete_status, 204);
}

// AC: PY-12.2
#[tokio::test]
async fn a_masked_secret_sent_back_keeps_its_value_and_reveal_shows_it() {
    let (app_router, _) = build_test_app();
    let sslcommerz = get_gateway(&app_router, "sslcommerz").await;
    let secret_name = sslcommerz["credentials"]
        .as_array()
        .and_then(|credentials| {
            credentials
                .iter()
                .find(|credential| credential["is_secret"] == true)
        })
        .and_then(|credential| credential["name"].as_str())
        .unwrap_or_default()
        .to_owned();
    let reveal_path = format!("{GATEWAYS_PATH}/sslcommerz/credentials/{secret_name}");
    let (_, revealed_before) = call_api(&app_router, "GET", &reveal_path, None).await;
    let mut renamed = to_gateway_input(sslcommerz);
    renamed["name"] = json!("SSLCommerz sandbox");

    let (update_status, updated) = call_api(
        &app_router,
        "PATCH",
        &format!("{GATEWAYS_PATH}/sslcommerz"),
        Some(&renamed),
    )
    .await;
    let (_, revealed_after) = call_api(&app_router, "GET", &reveal_path, None).await;

    assert_eq!(update_status, 200, "{updated}");
    assert_eq!(updated["name"], "SSLCommerz sandbox");
    assert_eq!(updated["is_modified"], true);
    assert!(
        !revealed_before["value"]
            .as_str()
            .unwrap_or_default()
            .starts_with("••••")
    );
    assert_eq!(revealed_after, revealed_before);
}

// AC: PY-12.2
#[tokio::test]
async fn an_edited_built_in_resets_to_default_and_cannot_be_deleted() {
    let (app_router, _) = build_test_app();
    let mut stripe = to_gateway_input(get_gateway(&app_router, "stripe").await);
    stripe["accent"] = json!("#000000");
    call_api(
        &app_router,
        "PATCH",
        &format!("{GATEWAYS_PATH}/stripe"),
        Some(&stripe),
    )
    .await;

    let (delete_status, delete_answer) = call_api(
        &app_router,
        "DELETE",
        &format!("{GATEWAYS_PATH}/stripe"),
        None,
    )
    .await;
    let (reset_status, reset) = call_api(
        &app_router,
        "POST",
        &format!("{GATEWAYS_PATH}/stripe/reset"),
        None,
    )
    .await;

    assert_eq!(delete_status, 409);
    assert_eq!(delete_answer["error"]["code"], "builtin_gateway");
    assert_eq!(reset_status, 200);
    assert_eq!(reset["is_modified"], false);
    assert_ne!(reset["accent"], "#000000");
}

// AC: PY-12.1
// AC: PY-12.2
#[tokio::test]
async fn a_gateway_offers_only_existing_methods_and_an_offered_method_cannot_be_deleted() {
    let (app_router, _) = build_test_app();
    let mut bkash = to_gateway_input(get_gateway(&app_router, "bkash").await);
    bkash["method_keys"] = json!(["bkash", "telepathy"]);
    let (unknown_status, unknown_answer) = call_api(
        &app_router,
        "PATCH",
        &format!("{GATEWAYS_PATH}/bkash"),
        Some(&bkash),
    )
    .await;
    bkash["method_keys"] = json!([]);
    let (empty_status, _) = call_api(
        &app_router,
        "PATCH",
        &format!("{GATEWAYS_PATH}/bkash"),
        Some(&bkash),
    )
    .await;
    let custom_method = json!({
        "key": "tap", "name": "Tap", "flow": "wallet", "accent": "#123456", "is_enabled": true,
        "test_cards": [],
        "test_numbers": [{ "number": "01770000001", "outcome": "succeed", "decline_reason": null }],
        "otp": "123456", "pin": "12121", "default_outcome": "succeed", "test_account": "",
    });
    call_api(
        &app_router,
        "POST",
        "/api/v1/payments/methods",
        Some(&custom_method),
    )
    .await;
    bkash["method_keys"] = json!(["bkash", "tap"]);
    call_api(
        &app_router,
        "PATCH",
        &format!("{GATEWAYS_PATH}/bkash"),
        Some(&bkash),
    )
    .await;

    let (delete_status, delete_answer) =
        call_api(&app_router, "DELETE", "/api/v1/payments/methods/tap", None).await;

    assert_eq!(unknown_status, 400);
    assert_eq!(unknown_answer["error"]["field"], "method_keys");
    assert_eq!(empty_status, 400);
    assert_eq!(delete_status, 409);
    assert_eq!(delete_answer["error"]["code"], "method_offered");
}
