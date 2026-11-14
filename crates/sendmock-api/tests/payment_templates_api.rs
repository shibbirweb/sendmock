#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use std::collections::BTreeMap;

use sendmock_ops::{AppEvent, OperationContext, fire_matching_rules};
use sendmock_payments::{
    sign_paddle_payload, sign_razorpay_payload, sign_sslcommerz_fields, sign_stripe_payload,
};
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use support::webhook_samples::{create_rule, endpoint_input};

/// The fixed clock of the test app, in seconds.
const NOW_SECONDS: i64 = 1_767_225_600;
const STRIPE_SECRET: &str = "whsec_test_secret";
const RAZORPAY_SECRET: &str = "rzp_webhook_secret";
const PADDLE_SECRET: &str = "pdl_ntfset_secret";
const SSLCOMMERZ_STORE_PASSWORD: &str = "testbox@ssl";

/// A provider's documented request: an example from its docs and the JSON Schema of its
/// fields, which the example itself must pass.
struct PaymentFormatFixture {
    content_type: String,
    documented_example: Value,
    schema: Value,
}

fn load_fixture(fixture_json: &str) -> PaymentFormatFixture {
    let fixture: Value = serde_json::from_str(fixture_json)
        .unwrap_or_else(|error| panic!("a readable fixture: {error}"));
    PaymentFormatFixture {
        content_type: fixture["content_type"]
            .as_str()
            .unwrap_or_default()
            .to_owned(),
        documented_example: fixture["documented_example"].clone(),
        schema: fixture["schema"].clone(),
    }
}

fn find_schema_errors(fixture: &PaymentFormatFixture, payload: &Value) -> Vec<String> {
    let validator = jsonschema::draft202012::new(&fixture.schema)
        .unwrap_or_else(|error| panic!("the fixture schema compiles: {error}"));
    validator
        .iter_errors(payload)
        .map(|validation_error| validation_error.to_string())
        .collect()
}

fn read_payload(content_type: &str, body: &str) -> Value {
    if content_type == "application/json" {
        return serde_json::from_str(body).unwrap_or(Value::Null);
    }
    let form_pairs: Vec<(String, String)> = serde_urlencoded::from_str(body).unwrap_or_default();
    Value::Object(
        form_pairs
            .into_iter()
            .map(|(field_name, field_value)| (field_name, Value::from(field_value)))
            .collect(),
    )
}

async fn create_secret_variables(app_router: &axum::Router) {
    for (variable_name, secret_value) in [
        ("stripe_webhook_secret", STRIPE_SECRET),
        ("razorpay_webhook_secret", RAZORPAY_SECRET),
        ("paddle_webhook_secret", PADDLE_SECRET),
        ("sslcommerz_store_password", SSLCOMMERZ_STORE_PASSWORD),
    ] {
        let (status, created) = call_api(
            app_router,
            "POST",
            "/api/v1/webhooks/variables",
            Some(&json!({
                "name": variable_name, "kind": "secret", "scope": "global",
                "endpoint_id": null, "value": secret_value, "random_mode": null,
                "description": "",
            })),
        )
        .await;
        assert_eq!(status, 201, "{created}");
    }
}

/// A checkout that settled at once, as the `auto_success` outcome profile does.
async fn create_paid_payment(app_router: &axum::Router, provider: &str, currency: &str) -> String {
    let (_, payment) = call_api(
        app_router,
        "POST",
        "/api/v1/payments/checkout",
        Some(&json!({
            "provider": provider, "amount_minor": 120_000, "currency": currency,
            "customer_email": "ruma@example.com",
        })),
    )
    .await;
    assert_eq!(payment["status"], "succeeded", "{payment}");
    payment["id"].as_str().unwrap_or_default().to_owned()
}

/// Renders a template against the payment and checks it against the provider's fixture.
async fn render_against_payment(
    app_router: &axum::Router,
    template_id: &str,
    payment_id: &str,
    fixture_json: &str,
) -> (BTreeMap<String, String>, String, Value) {
    let fixture = load_fixture(fixture_json);
    assert!(find_schema_errors(&fixture, &fixture.documented_example).is_empty());
    let (status, rendered) = call_api(
        app_router,
        "POST",
        &format!("/api/v1/webhooks/templates/{template_id}/render"),
        Some(&json!({ "payment_id": payment_id })),
    )
    .await;
    assert_eq!(status, 200, "{template_id}: {rendered}");
    assert_eq!(rendered["errors"], json!([]), "{template_id}: {rendered}");
    let headers: BTreeMap<String, String> =
        serde_json::from_value(rendered["headers"].clone()).unwrap_or_default();
    assert_eq!(headers["content-type"], fixture.content_type);
    let body = rendered["body"].as_str().unwrap_or_default().to_owned();
    let payload = read_payload(&fixture.content_type, &body);
    let schema_errors = find_schema_errors(&fixture, &payload);
    assert!(
        schema_errors.is_empty(),
        "{template_id} {payload}: {schema_errors:?}"
    );
    (headers, body, payload)
}

async fn build_paid_app() -> (axum::Router, OperationContext) {
    let (app_router, operation_context) = build_test_app();
    create_secret_variables(&app_router).await;
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "payment_outcome_profile": "auto_success" })),
    )
    .await;
    (app_router, operation_context)
}

// AC: PY-08.2
#[tokio::test]
async fn stripe_paypal_and_paddle_templates_render_a_real_payment_in_the_providers_shape() {
    let (app_router, _) = build_paid_app().await;
    let stripe_id = create_paid_payment(&app_router, "stripe", "USD").await;
    let paypal_id = create_paid_payment(&app_router, "paypal", "USD").await;
    let native_id = create_paid_payment(&app_router, "native", "USD").await;

    let (stripe_headers, stripe_body, stripe_event) = render_against_payment(
        &app_router,
        "stripe.event",
        &stripe_id,
        include_str!("fixtures/payment_webhooks/stripe_event.json"),
    )
    .await;
    let (_, _, paypal_event) = render_against_payment(
        &app_router,
        "paypal.webhook",
        &paypal_id,
        include_str!("fixtures/payment_webhooks/paypal_webhook.json"),
    )
    .await;
    let (_, _, paypal_ipn) = render_against_payment(
        &app_router,
        "paypal.ipn",
        &paypal_id,
        include_str!("fixtures/payment_webhooks/paypal_ipn.json"),
    )
    .await;
    let (paddle_headers, paddle_body, paddle_event) = render_against_payment(
        &app_router,
        "paddle.webhook",
        &native_id,
        include_str!("fixtures/payment_webhooks/paddle_webhook.json"),
    )
    .await;

    assert_eq!(stripe_event["type"], "payment_intent.succeeded");
    assert_eq!(stripe_event["data"]["object"]["amount"], 120_000);
    assert_eq!(
        stripe_event["data"]["object"]["receipt_email"],
        "ruma@example.com"
    );
    assert_eq!(
        stripe_headers["Stripe-Signature"],
        sign_stripe_payload(STRIPE_SECRET, NOW_SECONDS, &stripe_body)
    );
    assert_eq!(paypal_event["event_type"], "PAYMENT.CAPTURE.COMPLETED");
    assert_eq!(paypal_event["resource"]["amount"]["value"], "1200.00");
    assert_eq!(paypal_ipn["payment_status"], "Completed");
    assert_eq!(paddle_event["event_type"], "transaction.completed");
    assert_eq!(
        paddle_headers["Paddle-Signature"],
        sign_paddle_payload(PADDLE_SECRET, NOW_SECONDS, &paddle_body)
    );
}

// AC: PY-08.2
#[tokio::test]
async fn sslcommerz_bkash_and_razorpay_templates_render_a_real_payment_in_the_providers_shape() {
    let (app_router, _) = build_paid_app().await;
    let sslcommerz_id = create_paid_payment(&app_router, "sslcommerz", "BDT").await;
    let bkash_id = create_paid_payment(&app_router, "bkash", "BDT").await;
    let native_id = create_paid_payment(&app_router, "native", "INR").await;

    let (_, _, sslcommerz_ipn) = render_against_payment(
        &app_router,
        "sslcommerz.ipn",
        &sslcommerz_id,
        include_str!("fixtures/payment_webhooks/sslcommerz_ipn.json"),
    )
    .await;
    let (_, _, bkash_callback) = render_against_payment(
        &app_router,
        "bkash.callback",
        &bkash_id,
        include_str!("fixtures/payment_webhooks/bkash_callback.json"),
    )
    .await;
    let (razorpay_headers, razorpay_body, razorpay_event) = render_against_payment(
        &app_router,
        "razorpay.webhook",
        &native_id,
        include_str!("fixtures/payment_webhooks/razorpay_webhook.json"),
    )
    .await;

    assert_eq!(sslcommerz_ipn["status"], "VALID");
    assert_eq!(sslcommerz_ipn["amount"], "1200.00");
    let signed_fields: BTreeMap<String, String> =
        ["amount", "currency", "status", "tran_id", "val_id"]
            .into_iter()
            .map(|field_name| {
                let field_value = sslcommerz_ipn[field_name].as_str().unwrap_or_default();
                (field_name.to_owned(), field_value.to_owned())
            })
            .collect();
    assert_eq!(
        sslcommerz_ipn["verify_sign"],
        sign_sslcommerz_fields(SSLCOMMERZ_STORE_PASSWORD, &signed_fields)
    );
    assert_eq!(bkash_callback["status"], "success");
    assert_eq!(razorpay_event["event"], "payment.captured");
    assert_eq!(
        razorpay_event["payload"]["payment"]["entity"]["captured"],
        true
    );
    assert_eq!(
        razorpay_headers["X-Razorpay-Signature"],
        sign_razorpay_payload(RAZORPAY_SECRET, &razorpay_body)
    );
}

/// An endpoint sending Stripe events and a rule sending it every `payment.succeeded`.
async fn create_stripe_rule(app_router: &axum::Router) {
    let mut stripe_endpoint = endpoint_input("Shop webhooks");
    stripe_endpoint["template_id"] = json!("stripe.event");
    let (_, created_endpoint) = call_api(
        app_router,
        "POST",
        "/api/v1/webhooks/endpoints",
        Some(&stripe_endpoint),
    )
    .await;
    create_rule(
        app_router,
        &json!({
            "name": "Paid orders", "endpoint_id": created_endpoint["id"],
            "events": ["payment.succeeded"], "filter": null, "is_enabled": true,
        }),
    )
    .await;
}

async fn read_latest_event(app_router: &axum::Router, event_type: &str) -> AppEvent {
    let (_, recent_events) = call_api(
        app_router,
        "GET",
        &format!("/api/v1/events/recent?type={event_type}"),
        None,
    )
    .await;
    serde_json::from_value(recent_events[0].clone())
        .unwrap_or_else(|error| panic!("a {event_type} event: {error}"))
}

async fn read_rendered_request(operation_context: &OperationContext, delivery_id: &str) -> String {
    operation_context
        .webhook_delivery_repository
        .find_delivery(delivery_id)
        .await
        .ok()
        .flatten()
        .and_then(|stored_delivery| stored_delivery.rendered_request_json)
        .unwrap_or_default()
}

// AC: PY-08.1
#[tokio::test]
async fn a_rule_on_a_payment_event_delivers_it_with_the_payment_as_subject() {
    let (app_router, operation_context) = build_paid_app().await;
    create_stripe_rule(&app_router).await;
    let payment_id = create_paid_payment(&app_router, "stripe", "USD").await;
    let succeeded_event = read_latest_event(&app_router, "payment.succeeded").await;

    let queued_count = fire_matching_rules(&operation_context, &succeeded_event)
        .await
        .unwrap_or_default();

    let payment_intent_id = succeeded_event.data["provider_ids"]["payment_intent"]
        .as_str()
        .unwrap_or_default();
    assert!(payment_intent_id.starts_with("pi_"));
    assert_eq!(succeeded_event.data["amount_major"], "1200.00");
    assert!(succeeded_event.data.get("timeline").is_none());
    assert_eq!(queued_count, 1);
    let (_, deliveries) = call_api(
        &app_router,
        "GET",
        "/api/v1/webhooks/deliveries?event_type=payment.succeeded",
        None,
    )
    .await;
    let delivery = &deliveries["items"][0];
    assert_eq!(delivery["subject_id"], payment_id.as_str());
    let rendered_request = read_rendered_request(
        &operation_context,
        delivery["id"].as_str().unwrap_or_default(),
    )
    .await;
    assert!(
        rendered_request.contains(payment_intent_id),
        "{rendered_request}"
    );
}
