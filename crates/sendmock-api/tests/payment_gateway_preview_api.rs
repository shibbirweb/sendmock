#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const GATEWAYS_PATH: &str = "/api/v1/payments/gateways";

async fn read_gateway(app_router: &axum::Router, gateway_key: &str) -> Value {
    call_api(
        app_router,
        "GET",
        &format!("{GATEWAYS_PATH}/{gateway_key}"),
        None,
    )
    .await
    .1
}

async fn create_checkout(app_router: &axum::Router, provider: &str) -> String {
    let (_, payment) = call_api(
        app_router,
        "POST",
        "/api/v1/payments/checkout",
        Some(&json!({ "provider": provider, "amount_minor": 1200, "currency": "USD" })),
    )
    .await;
    payment["id"].as_str().unwrap_or_default().to_owned()
}

async fn preview_gateway(
    app_router: &axum::Router,
    gateway_key: &str,
    preview_request: Value,
) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        &format!("{GATEWAYS_PATH}/{gateway_key}/preview"),
        Some(&preview_request),
    )
    .await
}

// AC: PY-12.4
#[tokio::test]
async fn the_preview_renders_the_redirect_and_a_signed_notification_for_a_payment() {
    let (app_router, _) = build_test_app();
    let payment_id = create_checkout(&app_router, "stripe").await;
    let stripe = read_gateway(&app_router, "stripe").await;

    let (status, preview) = preview_gateway(
        &app_router,
        "stripe",
        json!({ "gateway": stripe, "event_type": "payment.succeeded", "redirect_outcome": "success" }),
    )
    .await;

    assert_eq!(status, 200, "{preview}");
    assert_eq!(preview["payment_id"], payment_id.as_str());
    assert_eq!(preview["redirect"]["method"], "GET");
    assert_eq!(
        preview["redirect"]["url"],
        "http://localhost:8000/checkout/success"
    );
    let notification = &preview["notification"];
    assert_eq!(notification["event_name"], "payment_intent.succeeded");
    assert_eq!(notification["headers"]["content-type"], "application/json");
    assert!(
        notification["headers"]["stripe-signature"]
            .as_str()
            .is_some_and(|signature| signature.starts_with("t=1767225600,v1="))
    );
    let body: Value =
        serde_json::from_str(notification["body"].as_str().unwrap_or_default()).unwrap_or_default();
    assert_eq!(body["type"], "payment_intent.succeeded");
    assert_eq!(body["id"], "evt_01JB7T9Q2RPREVIEW0000000");
    assert_eq!(body["data"]["object"]["object"], "payment_intent");
    assert_eq!(body["data"]["object"]["amount"], 1200);
    assert!(
        body["data"]["object"]["id"]
            .as_str()
            .is_some_and(|intent_id| intent_id.starts_with("pi_"))
    );
    assert!(
        preview["reference"]["functions"]
            .as_array()
            .is_some_and(|functions| functions
                .iter()
                .any(|function| function["name"] == "stripe_signature"))
    );
}

// AC: PY-12.4
#[tokio::test]
async fn the_preview_masks_secrets_and_names_each_problem_by_its_part() {
    let (app_router, _) = build_test_app();
    create_checkout(&app_router, "native").await;
    let mut stripe = read_gateway(&app_router, "stripe").await;
    stripe["redirect_fields"] = json!([
        { "name": "secret", "template": "{{ merchant.webhook_secret }}", "send_on": "always" },
        { "name": "broken", "template": "{{ nope() }}", "send_on": "always" },
        { "name": "missing", "template": "{{ payment.nothing }}", "send_on": "always" },
    ]);
    stripe["event_names"]["payment.created"] = json!("");

    let (_, preview) = preview_gateway(
        &app_router,
        "stripe",
        json!({ "gateway": stripe, "event_type": "payment.created", "redirect_outcome": "fail" }),
    )
    .await;

    assert_eq!(preview["redirect"]["fields"]["secret"], "••••0000");
    assert!(preview["notification"].is_null(), "{preview}");
    let problems = preview["problems"].as_array().cloned().unwrap_or_default();
    assert!(problems.iter().any(|problem| {
        problem["part"] == "Redirect field broken" && problem["severity"] == "error"
    }));
    assert!(problems.iter().any(|problem| {
        problem["part"] == "Redirect field missing" && problem["severity"] == "warning"
    }));
}

#[tokio::test]
async fn the_preview_answers_without_a_payment() {
    let (app_router, _) = build_test_app();
    let native = read_gateway(&app_router, "native").await;

    let (status, preview) = preview_gateway(
        &app_router,
        "native",
        json!({ "gateway": native, "event_type": "payment.succeeded", "redirect_outcome": "success" }),
    )
    .await;

    assert_eq!(status, 200, "{preview}");
    assert!(preview["payment_id"].is_null());
    assert!(preview["notification"].is_null());
}

// AC: PY-12.4
#[tokio::test]
async fn a_gateway_save_with_template_errors_is_refused() {
    let (app_router, _) = build_test_app();
    let mut stripe = read_gateway(&app_router, "stripe").await;
    stripe["notification_body"] = json!("{\"id\": \"{{ nope() }}\"}");

    let (status, refusal) = call_api(
        &app_router,
        "PATCH",
        &format!("{GATEWAYS_PATH}/stripe"),
        Some(&stripe),
    )
    .await;

    assert_eq!(status, 400, "{refusal}");
    assert!(
        refusal["error"]["message"]
            .as_str()
            .is_some_and(|message| message.starts_with("Notification body: "))
    );
    let unchanged = read_gateway(&app_router, "stripe").await;
    assert_eq!(unchanged["is_modified"], false);
}
