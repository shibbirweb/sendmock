#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const METHODS_PATH: &str = "/api/v1/payments/methods";

fn upay_method() -> Value {
    json!({
        "key": "upay",
        "name": "Upay",
        "flow": "wallet",
        "accent": "#0a7cff",
        "is_enabled": true,
        "test_cards": [],
        "test_numbers": [
            { "number": "01770000001", "outcome": "succeed", "decline_reason": null },
            { "number": "01770000003", "outcome": "wrong_pin", "decline_reason": null },
        ],
        "otp": "123456",
        "pin": "12121",
        "default_outcome": "succeed",
        "test_account": "",
    })
}

async fn get_method(app_router: &axum::Router, method_key: &str) -> Value {
    let (status, payment_method) = call_api(
        app_router,
        "GET",
        &format!("{METHODS_PATH}/{method_key}"),
        None,
    )
    .await;
    assert_eq!(status, 200, "{payment_method}");
    payment_method
}

// AC: PY-12.1
#[tokio::test]
async fn lists_the_built_in_methods_with_the_gateways_offering_them() {
    let (app_router, _) = build_test_app();

    let (status, payment_methods) = call_api(&app_router, "GET", METHODS_PATH, None).await;

    assert_eq!(status, 200);
    assert_eq!(payment_methods.as_array().map(Vec::len), Some(8));
    let card = &payment_methods[0];
    assert_eq!(card["key"], "card");
    assert_eq!(card["flow"], "card");
    assert_eq!(card["test_cards"][0]["number"], "4242424242424242");
    assert_eq!(
        card["gateway_keys"],
        json!(["stripe", "sslcommerz", "native"])
    );
    assert_eq!(card["is_modified"], false);
    let (_, wallet_flow) =
        call_api(&app_router, "GET", "/api/v1/payments/flows/wallet", None).await;
    assert!(wallet_flow["method_count"].as_u64().unwrap_or_default() >= 1);
}

// AC: PY-12.1
#[tokio::test]
async fn a_custom_method_is_added_from_a_flow_changed_and_deleted() {
    let (app_router, _) = build_test_app();

    let (create_status, created) =
        call_api(&app_router, "POST", METHODS_PATH, Some(&upay_method())).await;
    let mut renamed = upay_method();
    renamed["name"] = json!("Upay wallet");
    renamed["flow"] = json!("card");
    let (update_status, updated) = call_api(
        &app_router,
        "PATCH",
        &format!("{METHODS_PATH}/upay"),
        Some(&renamed),
    )
    .await;
    let (_, wallet_flow) =
        call_api(&app_router, "GET", "/api/v1/payments/flows/wallet", None).await;
    let (delete_status, _) =
        call_api(&app_router, "DELETE", &format!("{METHODS_PATH}/upay"), None).await;
    let (missing_status, _) =
        call_api(&app_router, "GET", &format!("{METHODS_PATH}/upay"), None).await;

    assert_eq!(create_status, 201, "{created}");
    assert_eq!(created["is_builtin"], false);
    assert_eq!(created["gateway_keys"], json!([]));
    assert_eq!(update_status, 200, "{updated}");
    assert_eq!(updated["name"], "Upay wallet");
    assert_eq!(
        updated["flow"], "wallet",
        "the flow is fixed after creation"
    );
    assert!(wallet_flow["method_count"].as_u64().unwrap_or_default() >= 2);
    assert_eq!(delete_status, 204);
    assert_eq!(missing_status, 404);
}

// AC: PY-12.1
#[tokio::test]
async fn an_edited_built_in_shows_modified_until_reset_and_cannot_be_deleted() {
    let (app_router, _) = build_test_app();
    let mut bkash = get_method(&app_router, "bkash").await;
    bkash["otp"] = json!("654321");

    let (update_status, _) = call_api(
        &app_router,
        "PATCH",
        &format!("{METHODS_PATH}/bkash"),
        Some(&bkash),
    )
    .await;
    let edited = get_method(&app_router, "bkash").await;
    let (delete_status, delete_answer) = call_api(
        &app_router,
        "DELETE",
        &format!("{METHODS_PATH}/bkash"),
        None,
    )
    .await;
    let (reset_status, reset) = call_api(
        &app_router,
        "POST",
        &format!("{METHODS_PATH}/bkash/reset"),
        None,
    )
    .await;

    assert_eq!(update_status, 200);
    assert_eq!(edited["is_modified"], true);
    assert_eq!(edited["otp"], "654321");
    assert_eq!(delete_status, 409);
    assert_eq!(delete_answer["error"]["code"], "builtin_method");
    assert_eq!(reset_status, 200);
    assert_eq!(reset["is_modified"], false);
    assert_ne!(reset["otp"], "654321");
}

// AC: PY-01.1
// AC: PY-12.1
#[tokio::test]
async fn a_method_with_test_values_its_flow_refuses_is_rejected() {
    let (app_router, _) = build_test_app();
    let mut real_card = upay_method();
    real_card["key"] = json!("office_card");
    real_card["flow"] = json!("card");
    real_card["test_cards"] =
        json!([{ "number": "4111 1111 1111 1111", "outcome": "succeed", "decline_reason": null }]);
    let mut short_pin = upay_method();
    short_pin["pin"] = json!("12");
    let mut unknown_flow = upay_method();
    unknown_flow["flow"] = json!("telepathy");

    let (card_status, card_answer) =
        call_api(&app_router, "POST", METHODS_PATH, Some(&real_card)).await;
    let (pin_status, pin_answer) =
        call_api(&app_router, "POST", METHODS_PATH, Some(&short_pin)).await;
    let (flow_status, flow_answer) =
        call_api(&app_router, "POST", METHODS_PATH, Some(&unknown_flow)).await;

    assert_eq!(card_status, 400);
    assert_eq!(card_answer["error"]["field"], "test_cards");
    assert_eq!(pin_status, 400);
    assert_eq!(pin_answer["error"]["field"], "pin");
    assert_eq!(flow_status, 400);
    assert_eq!(flow_answer["error"]["field"], "flow");
}
