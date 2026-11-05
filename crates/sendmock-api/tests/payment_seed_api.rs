#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use std::sync::Arc;

use sendmock_ops::FixedEnvironment;
use serde_json::{Value, json};
use support::test_app::{build_test_app_with, call_api, call_api_text};

const UPAY_SECRET: &str = "upay-live-looking-secret";

fn build_app() -> axum::Router {
    let environment =
        FixedEnvironment::default().with_variable("UPAY_GATEWAY_API_SECRET_SECRET", UPAY_SECRET);
    let (app_router, _) = build_test_app_with(|operation_context| {
        operation_context.with_environment_reader(Arc::new(environment))
    });
    app_router
}

async fn send(app_router: &axum::Router, method: &str, path: &str, body: &Value) -> Value {
    let (status, answer) = call_api(app_router, method, path, Some(body)).await;
    assert!(
        (200..300).contains(&status),
        "{method} {path}: {status} {answer}"
    );
    answer
}

async fn read(app_router: &axum::Router, path: &str) -> Value {
    let (status, answer) = call_api(app_router, "GET", path, None).await;
    assert_eq!(status, 200, "{path}: {answer}");
    answer
}

async fn export_seed(app_router: &axum::Router) -> String {
    let (status, _, seed_toml) = call_api_text(app_router, "/api/v1/seed/export").await;
    assert_eq!(status, 200);
    seed_toml
}

async fn apply_seed(app_router: &axum::Router, seed_toml: &str) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        "/api/v1/seed/apply",
        Some(&json!({ "seed_toml": seed_toml })),
    )
    .await
}

fn endpoint_input() -> Value {
    json!({
        "name": "Shop payments", "url": "http://localhost:3000/payments/ipn", "method": "POST",
        "headers": {}, "extra_fields": {}, "template_id": "native", "template_mode": "linked",
        "timeout_ms": 10_000,
        "retry_policy": { "max_attempts": 3, "backoff_seconds": [1, 5], "retry_on_client_errors": false },
        "is_enabled": true, "query_params": [], "body_mode": "template", "body_fields": [],
        "fields_encoding": "json", "raw_content_type": "application/json", "raw_body": "",
        "render_mode": "strict",
    })
}

async fn configure_upay_gateway(app_router: &axum::Router, endpoint_id: &Value) {
    send(
        app_router,
        "POST",
        "/api/v1/payments/gateways",
        &json!({
            "name": "Upay", "key": "upay_gateway", "start_from": null,
        }),
    )
    .await;
    let mut upay_gateway = read(app_router, "/api/v1/payments/gateways/upay_gateway").await;
    upay_gateway["method_keys"] = json!(["upay"]);
    upay_gateway["notification_endpoint_id"] = endpoint_id.clone();
    upay_gateway["credentials"] = json!([
        { "name": "merchant_id", "value": "UPAY-MERCHANT-1", "is_secret": false },
        { "name": "api_secret", "value": UPAY_SECRET, "is_secret": true },
    ]);
    send(
        app_router,
        "PATCH",
        "/api/v1/payments/gateways/upay_gateway",
        &upay_gateway,
    )
    .await;
}

/// A QR wallet flow, the Upay method running it, a Upay gateway offering it with a secret and
/// notifying "Shop payments", and the built-in bKash method with another OTP.
async fn configure_payments(app_router: &axum::Router) {
    let endpoint = send(
        app_router,
        "POST",
        "/api/v1/webhooks/endpoints",
        &endpoint_input(),
    )
    .await;
    send(app_router, "POST", "/api/v1/payments/flows", &json!({
        "key": "qr_wallet", "name": "QR wallet", "picker_tab": "Mobile banking",
        "steps": [{ "type": "qr_code", "title": "Scan to pay", "field_label": "", "hint": "Open {method}.", "button_label": "I have paid" }],
    }))
    .await;
    send(app_router, "POST", "/api/v1/payments/methods", &json!({
        "key": "upay", "name": "Upay", "flow": "qr_wallet", "accent": "#0a7cff", "is_enabled": true,
        "test_cards": [],
        "test_numbers": [{ "number": "01770000001", "outcome": "succeed", "decline_reason": null }],
        "otp": "123456", "pin": "12121", "default_outcome": "succeed", "test_account": "",
    }))
    .await;
    configure_upay_gateway(app_router, &endpoint["id"]).await;
    let mut bkash = read(app_router, "/api/v1/payments/methods/bkash").await;
    bkash["otp"] = json!("654321");
    send(
        app_router,
        "PATCH",
        "/api/v1/payments/methods/bkash",
        &bkash,
    )
    .await;
}

// AC: PL-04.2
#[tokio::test]
async fn payment_definitions_export_with_secrets_as_references_and_endpoints_by_name() {
    let app_router = build_app();
    configure_payments(&app_router).await;

    let seed_toml = export_seed(&app_router).await;

    for expected_text in [
        "[[payments.flows]]",
        "[[payments.methods]]",
        "[[payments.gateways]]",
        "key = \"qr_wallet\"",
        "key = \"upay\"",
        "key = \"bkash\"",
        "key = \"upay_gateway\"",
        "notification_endpoint = \"Shop payments\"",
        "${UPAY_GATEWAY_API_SECRET_SECRET}",
        "UPAY-MERCHANT-1",
    ] {
        assert!(
            seed_toml.contains(expected_text),
            "{expected_text} in\n{seed_toml}"
        );
    }
    assert!(!seed_toml.contains(UPAY_SECRET), "{seed_toml}");
    assert!(!seed_toml.contains("key = \"stripe\""), "{seed_toml}");
}

// AC: PL-04.4
#[tokio::test]
async fn an_exported_payment_seed_reproduces_flows_methods_and_gateways_on_a_fresh_instance() {
    let first_app = build_app();
    configure_payments(&first_app).await;
    let exported_seed = export_seed(&first_app).await;
    let fresh_app = build_app();
    send(
        &fresh_app,
        "POST",
        "/api/v1/webhooks/endpoints",
        &endpoint_input(),
    )
    .await;

    let (status, answer) = apply_seed(&fresh_app, &exported_seed).await;

    assert_eq!(status, 200, "{answer}\n{exported_seed}");
    assert_eq!(export_seed(&fresh_app).await, exported_seed);
    let upay_gateway = read(&fresh_app, "/api/v1/payments/gateways/upay_gateway").await;
    assert_eq!(upay_gateway["method_keys"], json!(["upay"]));
    assert!(upay_gateway["notification_endpoint_id"].is_string());
    let (_, revealed) = call_api(
        &fresh_app,
        "GET",
        "/api/v1/payments/gateways/upay_gateway/credentials/api_secret",
        None,
    )
    .await;
    assert_eq!(revealed["value"], UPAY_SECRET, "{revealed}");
    assert_eq!(
        read(&fresh_app, "/api/v1/payments/methods/bkash").await["otp"],
        "654321"
    );
    assert_eq!(
        read(&fresh_app, "/api/v1/payments/methods/upay").await["flow"],
        "qr_wallet"
    );
}

// AC: PL-04.3
#[tokio::test]
async fn reset_puts_payment_definitions_back_as_the_seed_has_them() {
    let app_router = build_app();
    configure_payments(&app_router).await;
    let seed_toml = export_seed(&app_router).await;
    apply_seed(&app_router, &seed_toml).await;
    let mut stripe = read(&app_router, "/api/v1/payments/gateways/stripe").await;
    stripe["accent"] = json!("#000000");
    send(
        &app_router,
        "PATCH",
        "/api/v1/payments/gateways/stripe",
        &stripe,
    )
    .await;
    send(&app_router, "POST", "/api/v1/payments/flows", &json!({
        "key": "voucher_only", "name": "Voucher", "picker_tab": "Vouchers",
        "steps": [{ "type": "voucher_code", "title": "", "field_label": "Voucher", "hint": "", "button_label": "Pay" }],
    }))
    .await;

    let (status, _) = call_api(&app_router, "POST", "/api/v1/reset", None).await;

    assert_eq!(status, 204);
    assert_eq!(export_seed(&app_router).await, seed_toml);
    let (missing_status, _) = call_api(
        &app_router,
        "GET",
        "/api/v1/payments/flows/voucher_only",
        None,
    )
    .await;
    assert_eq!(missing_status, 404);
    assert_eq!(
        read(&app_router, "/api/v1/payments/gateways/stripe").await["is_modified"],
        false
    );
}
