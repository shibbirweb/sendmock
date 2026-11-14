use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use tower::ServiceExt;

use super::payment_notification_fixture::{NotificationFixture, build_fixture};
use super::scripted_webhook_sender::ScriptedWebhookSender;
use super::test_app::call_api;

pub const UPAY_PATH: &str = "/providers/upay";
pub const MERCHANT_ID: &str = "UPAY-MERCHANT-1";
pub const API_SECRET: &str = "upay-secret-key";
pub const SUCCESS_URL: &str = "https://shop.example/upay/success";
pub const FAIL_URL: &str = "https://shop.example/upay/fail";
pub const CANCEL_URL: &str = "https://shop.example/upay/cancel";

/// A raw answer: the status, the `Content-Type` and the body text.
pub struct RawAnswer {
    pub status: u16,
    pub content_type: String,
    pub body: String,
}

impl RawAnswer {
    pub fn json(&self) -> Value {
        serde_json::from_str(&self.body).unwrap_or(Value::Null)
    }
}

pub async fn send_raw(app_router: &axum::Router, request: Request<Body>) -> RawAnswer {
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|header_value| header_value.to_str().ok())
        .unwrap_or_default()
        .to_owned();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    RawAnswer {
        status,
        content_type,
        body: String::from_utf8_lossy(&body_bytes).into_owned(),
    }
}

pub fn build_request(method: &str, uri: &str, content_type: &str, body: String) -> Request<Body> {
    Request::builder()
        .method(method)
        .uri(uri)
        .header("content-type", content_type)
        .body(Body::from(body))
        .unwrap_or_else(|error| panic!("a valid request: {error}"))
}

/// Upay as the Add a payment gateway guide builds it, paid by card here.
fn upay_definition(endpoint_id: &str) -> Value {
    json!({
        "key": "upay", "name": "Upay", "accent": "#0a7cff", "is_enabled": true,
        "method_keys": ["card"],
        "credentials": [
            { "name": "merchant_id", "value": MERCHANT_ID, "is_secret": false },
            { "name": "api_secret", "value": API_SECRET, "is_secret": true },
        ],
        "notification_endpoint_id": endpoint_id,
        "redirect_method": "GET",
        "redirect_fields": [
            { "name": "payment_ref_id", "template": "{{ payment.reference }}", "send_on": "always" },
            { "name": "status", "template": "{{ redirect.status }}", "send_on": "always" },
        ],
        "notification_content_type": "json",
        "event_names": { "payment.succeeded": "COMPLETED", "payment.failed": "FAILED" },
        "notification_body": "{\"payment_ref_id\": \"{{ payment.reference }}\", \"status\": \"{{ event.name }}\", \"amount\": \"{{ payment.amount_major }}\", \"currency\": \"{{ payment.currency }}\", \"merchant_id\": \"{{ merchant.merchant_id }}\"}",
        "notification_headers": [
            { "name": "X-Upay-Signature", "template": "{{ body | hmac_sha256(merchant.api_secret) }}" },
        ],
    })
}

async fn read_endpoint_id(app_router: &axum::Router) -> String {
    let (_, endpoints) = call_api(app_router, "GET", "/api/v1/webhooks/endpoints", None).await;
    let endpoint_list = endpoints.get("items").unwrap_or(&endpoints);
    endpoint_list[0]["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

/// A custom Upay gateway notifying the "Shop payments" endpoint.
pub async fn build_upay_fixture() -> NotificationFixture {
    let fixture = build_fixture(ScriptedWebhookSender::default(), &[]).await;
    let app_router = &fixture.app_router;
    let (status, created) = call_api(
        app_router,
        "POST",
        "/api/v1/payments/gateways",
        Some(&json!({ "name": "Upay", "key": "upay", "start_from": null })),
    )
    .await;
    assert_eq!(status, 201, "{created}");
    let endpoint_id = read_endpoint_id(app_router).await;
    let (status, saved) = call_api(
        app_router,
        "PATCH",
        "/api/v1/payments/gateways/upay",
        Some(&upay_definition(&endpoint_id)),
    )
    .await;
    assert_eq!(status, 200, "{saved}");
    fixture
}

pub fn checkout_body() -> Value {
    json!({
        "amount": "1250.50", "currency": "BDT", "reference": "SHOP-ORDER-9",
        "success_url": SUCCESS_URL, "fail_url": FAIL_URL, "cancel_url": CANCEL_URL,
        "customer_email": "ruma@example.com", "customer_name": "Ruma Akter",
        "description": "Blue mug", "metadata": { "cart": "42" },
        "merchant_id": MERCHANT_ID,
    })
}

pub async fn start_checkout(app_router: &axum::Router, checkout_fields: &Value) -> RawAnswer {
    let checkout_request = build_request(
        "POST",
        &format!("{UPAY_PATH}/checkout"),
        "application/json",
        checkout_fields.to_string(),
    );
    send_raw(app_router, checkout_request).await
}

pub async fn validate_payment(app_router: &axum::Router, payment_reference: &str) -> RawAnswer {
    let validation_request = Request::builder()
        .method("GET")
        .uri(format!("{UPAY_PATH}/payments/{payment_reference}"))
        .body(Body::empty())
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    send_raw(app_router, validation_request).await
}

pub async fn complete_checkout(app_router: &axum::Router, payment_id: &str, action: &str) -> Value {
    let checkout = if action == "pay" {
        json!({
            "action": "pay", "method_key": "card",
            "card": { "number": "4242424242424242", "exp_month": 12, "exp_year": 2030, "cvc": "123" },
        })
    } else {
        json!({ "action": action })
    };
    let (status, session) = call_api(
        app_router,
        "POST",
        &format!("/api/v1/checkout-sessions/{payment_id}/complete"),
        Some(&checkout),
    )
    .await;
    assert_eq!(status, 200, "{session}");
    session
}
