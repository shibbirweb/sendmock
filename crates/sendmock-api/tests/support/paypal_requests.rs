use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use tower::ServiceExt;

pub const PAYPAL_PATH: &str = "/providers/paypal";
pub const TEST_ACCESS_TOKEN: &str = "A21AAtest-token";

/// What PayPal answered: status, `Paypal-Debug-Id` and the body as JSON.
pub struct PayPalReply {
    pub status: u16,
    pub debug_id: Option<String>,
    pub body: Value,
}

/// A request as the PayPal SDKs send it: JSON with a Bearer token, or the given
/// `Authorization`.
pub async fn send_paypal_request(
    app_router: &axum::Router,
    request_builder: axum::http::request::Builder,
    request_body: String,
) -> PayPalReply {
    let request = request_builder
        .body(Body::from(request_body))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let debug_id = response
        .headers()
        .get("paypal-debug-id")
        .and_then(|header_value| header_value.to_str().ok())
        .map(str::to_owned);
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    PayPalReply {
        status,
        debug_id,
        body: serde_json::from_slice(&body_bytes).unwrap_or(Value::Null),
    }
}

pub async fn call_paypal(
    app_router: &axum::Router,
    method: &str,
    path: &str,
    request_body: Option<&Value>,
) -> PayPalReply {
    let request_builder = Request::builder()
        .method(method)
        .uri(format!("{PAYPAL_PATH}{path}"))
        .header("content-type", "application/json")
        .header("authorization", format!("Bearer {TEST_ACCESS_TOKEN}"))
        .header("prefer", "return=representation");
    let body_text = request_body.map(Value::to_string).unwrap_or_default();
    send_paypal_request(app_router, request_builder, body_text).await
}

/// An order for 25.00 USD returning to the shop, as `return=representation` answers it.
pub async fn create_order(app_router: &axum::Router) -> PayPalReply {
    call_paypal(
        app_router,
        "POST",
        "/v2/checkout/orders",
        Some(&json!({
            "intent": "CAPTURE",
            "purchase_units": [{
                "reference_id": "order-7",
                "invoice_id": "INV-7",
                "amount": {"currency_code": "USD", "value": "25.00"},
            }],
            "payment_source": {"paypal": {"experience_context": {
                "return_url": "https://shop.example/paypal/return",
                "cancel_url": "https://shop.example/paypal/cancel",
            }}},
        })),
    )
    .await
}

pub fn read_text(json_value: &Value) -> String {
    json_value.as_str().unwrap_or_default().to_owned()
}

/// The order's link with this `rel`.
pub fn find_link(paypal_object: &Value, link_rel: &str) -> Option<String> {
    paypal_object["links"].as_array().and_then(|links| {
        links
            .iter()
            .find(|link| link["rel"] == link_rel)
            .map(|link| read_text(&link["href"]))
    })
}

/// The payer acts on the checkout page: `pay` approves, `decline` is the bank refusing.
pub async fn act_on_page(app_router: &axum::Router, order: &Value, checkout_action: &str) -> Value {
    let page_url = find_link(order, "payer-action")
        .or_else(|| find_link(order, "approve"))
        .unwrap_or_else(|| panic!("an approval link in {order}"));
    let payment_id = page_url.rsplit('/').next().unwrap_or_default().to_owned();
    let (status, answer) = super::test_app::call_api(
        app_router,
        "POST",
        &format!("/api/v1/checkout-sessions/{payment_id}/complete"),
        Some(&json!({"action": checkout_action, "method_key": "paypal_account"})),
    )
    .await;
    assert_eq!(status, 200, "{answer}");
    answer
}

pub fn read_issue(paypal_reply: &PayPalReply) -> Value {
    paypal_reply.body["details"][0]["issue"].clone()
}
