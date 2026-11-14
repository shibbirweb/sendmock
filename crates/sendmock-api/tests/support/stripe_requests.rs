use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use tower::ServiceExt;

pub const STRIPE_PATH: &str = "/providers/stripe/v1";
pub const TEST_SECRET_KEY: &str = "sk_test_shop0000000000000000";

/// What Stripe answered: status, `Request-Id` and the body as JSON.
pub struct StripeReply {
    pub status: u16,
    pub request_id: Option<String>,
    pub body: Value,
}

/// A request as the Stripe SDKs send it: form-encoded, with the key as a Bearer token.
pub async fn call_stripe_with_key(
    app_router: &axum::Router,
    method: &str,
    path: &str,
    form_body: &str,
    api_key: Option<&str>,
) -> StripeReply {
    let mut request_builder = Request::builder()
        .method(method)
        .uri(format!("{STRIPE_PATH}{path}"))
        .header("content-type", "application/x-www-form-urlencoded");
    if let Some(api_key) = api_key {
        request_builder = request_builder.header("authorization", format!("Bearer {api_key}"));
    }
    let request = request_builder
        .body(Body::from(form_body.to_owned()))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let request_id = response
        .headers()
        .get("request-id")
        .and_then(|header_value| header_value.to_str().ok())
        .map(str::to_owned);
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    StripeReply {
        status,
        request_id,
        body: serde_json::from_slice(&body_bytes).unwrap_or(Value::Null),
    }
}

pub async fn call_stripe(
    app_router: &axum::Router,
    method: &str,
    path: &str,
    form_body: &str,
) -> StripeReply {
    call_stripe_with_key(app_router, method, path, form_body, Some(TEST_SECRET_KEY)).await
}

/// A PaymentIntent for 20.00 USD with these extra parameters; answers the reply.
pub async fn create_payment_intent(app_router: &axum::Router, extra_form: &str) -> StripeReply {
    call_stripe(
        app_router,
        "POST",
        "/payment_intents",
        &format!("amount=2000&currency=usd&{extra_form}"),
    )
    .await
}

pub fn read_text(json_value: &Value) -> String {
    json_value.as_str().unwrap_or_default().to_owned()
}

/// The payment SendMock keeps for a Stripe object, found by its main id (the session's, else
/// the PaymentIntent's).
pub async fn find_payment(app_router: &axum::Router, provider_reference: &str) -> Value {
    let (_, payment_page) =
        super::test_app::call_api(app_router, "GET", "/api/v1/payments?provider=stripe", None)
            .await;
    let payment_id = payment_page["items"]
        .as_array()
        .and_then(|payments| {
            payments
                .iter()
                .find(|payment| payment["provider_reference"] == json!(provider_reference))
        })
        .map(|payment| read_text(&payment["id"]))
        .unwrap_or_else(|| panic!("a payment for {provider_reference} in {payment_page}"));
    super::test_app::call_api(
        app_router,
        "GET",
        &format!("/api/v1/payments/{payment_id}"),
        None,
    )
    .await
    .1
}

pub fn list_timeline_kinds(payment: &Value) -> Vec<String> {
    payment["timeline"]
        .as_array()
        .map(|timeline| {
            timeline
                .iter()
                .map(|entry| read_text(&entry["kind"]))
                .collect()
        })
        .unwrap_or_default()
}
