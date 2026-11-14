use std::collections::BTreeMap;

use axum::body::Body;
use axum::http::Request;
use sendmock_payments::sign_sslcommerz_fields;
use serde_json::{Value, json};
use tower::ServiceExt;

use super::payment_notification_fixture::{NotificationFixture, build_fixture};
use super::scripted_webhook_sender::ScriptedWebhookSender;
use super::test_app::call_api;

pub const SSLCOMMERZ_PATH: &str = "/providers/sslcommerz";
pub const STORE_ID: &str = "sendm0000000001";
pub const STORE_PASSWORD: &str = "sendm0000000001@ssl";
pub const SUCCESS_URL: &str = "https://shop.example/sslcommerz/success";
pub const FAIL_URL: &str = "https://shop.example/sslcommerz/fail";
pub const CANCEL_URL: &str = "https://shop.example/sslcommerz/cancel";

pub async fn send_request(router: axum::Router, request: Request<Body>) -> (u16, Value) {
    let response = router
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    (
        status,
        serde_json::from_slice(&body_bytes).unwrap_or(Value::Null),
    )
}

pub fn build_form_request(uri: &str, form_fields: &[(&str, &str)]) -> Request<Body> {
    let form_body = serde_urlencoded::to_string(form_fields).unwrap_or_default();
    Request::builder()
        .method("POST")
        .uri(uri)
        .header("content-type", "application/x-www-form-urlencoded")
        .body(Body::from(form_body))
        .unwrap_or_else(|error| panic!("a valid request: {error}"))
}

/// A form posted as `multipart/form-data`, as the `form-data` package of SSLCommerz's Node
/// library writes it.
pub fn build_multipart_request(uri: &str, form_fields: &[(&str, &str)]) -> Request<Body> {
    let boundary = "--------------------------515890814546601021194782";
    let mut multipart_body = String::new();
    for (field_name, field_value) in form_fields {
        multipart_body.push_str(&format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"{field_name}\"\r\n\r\n{field_value}\r\n"
        ));
    }
    multipart_body.push_str(&format!("--{boundary}--\r\n"));
    Request::builder()
        .method("POST")
        .uri(uri)
        .header(
            "content-type",
            format!("multipart/form-data; boundary={boundary}"),
        )
        .body(Body::from(multipart_body))
        .unwrap_or_else(|error| panic!("a valid request: {error}"))
}

/// A session as SSLCommerz's PHP library starts one, with the given fields changed.
pub async fn init_session(app_router: &axum::Router, changed_fields: &[(&str, &str)]) -> Value {
    let mut session_fields = vec![
        ("store_id", STORE_ID),
        ("store_passwd", STORE_PASSWORD),
        ("total_amount", "1250.50"),
        ("currency", "BDT"),
        ("tran_id", "SHOP-ORDER-7"),
        ("success_url", SUCCESS_URL),
        ("fail_url", FAIL_URL),
        ("cancel_url", CANCEL_URL),
        ("cus_name", "Ruma Akter"),
        ("cus_email", "ruma@example.com"),
        ("cus_phone", "01711111111"),
        ("product_name", "Blue mug"),
        ("value_a", "cart-42"),
    ];
    for (field_name, field_value) in changed_fields {
        session_fields.retain(|(kept_name, _)| kept_name != field_name);
        if !field_value.is_empty() {
            session_fields.push((field_name, field_value));
        }
    }
    let session_request = build_form_request(
        &format!("{SSLCOMMERZ_PATH}/gwprocess/v4/api.php"),
        &session_fields,
    );
    let (status, session) = send_request(app_router.clone(), session_request).await;
    assert_eq!(status, 200, "{session}");
    session
}

pub fn read_payment_id(session: &Value) -> String {
    session["GatewayPageURL"]
        .as_str()
        .and_then(|page_url| page_url.rsplit('/').next())
        .unwrap_or_default()
        .to_owned()
}

pub async fn complete_checkout(
    app_router: &axum::Router,
    payment_id: &str,
    checkout: Value,
) -> Value {
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

pub fn pay_with_card(card_number: &str) -> Value {
    json!({
        "action": "pay", "method_key": "card",
        "card": { "number": card_number, "exp_month": 12, "exp_year": 2030, "cvc": "123" },
    })
}

pub async fn validate_order(
    app_router: &axum::Router,
    val_id: &str,
    store_password: &str,
) -> Value {
    let query = serde_urlencoded::to_string([
        ("val_id", val_id),
        ("store_id", STORE_ID),
        ("store_passwd", store_password),
        ("format", "json"),
        ("v", "1"),
    ])
    .unwrap_or_default();
    let validation_request = Request::builder()
        .method("GET")
        .uri(format!(
            "{SSLCOMMERZ_PATH}/validator/api/validationserverAPI.php?{query}"
        ))
        .body(Body::empty())
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let (status, validated_order) = send_request(app_router.clone(), validation_request).await;
    assert_eq!(status, 200, "{validated_order}");
    validated_order
}

/// Checks `verify_sign` as SSLCommerz's PHP library does: the fields `verify_key` names,
/// with the MD5 of the store password, sorted and hashed.
pub fn has_valid_sign(posted_fields: &BTreeMap<String, String>) -> bool {
    let read_field = |field_name: &str| posted_fields.get(field_name).cloned().unwrap_or_default();
    let signed_fields: BTreeMap<String, String> = read_field("verify_key")
        .split(',')
        .filter_map(|field_name| {
            posted_fields
                .get(field_name)
                .map(|field_value| (field_name.to_owned(), field_value.clone()))
        })
        .collect();
    !signed_fields.is_empty()
        && sign_sslcommerz_fields(STORE_PASSWORD, &signed_fields) == read_field("verify_sign")
}

pub fn read_form(form_body: &str) -> BTreeMap<String, String> {
    serde_urlencoded::from_str(form_body).unwrap_or_default()
}

pub fn read_redirect_fields(checkout_session: &Value) -> BTreeMap<String, String> {
    serde_json::from_value(checkout_session["redirect"]["fields"].clone()).unwrap_or_default()
}

pub async fn build_sslcommerz_fixture() -> NotificationFixture {
    build_fixture(ScriptedWebhookSender::default(), &["sslcommerz"]).await
}

/// The IPN SSLCommerz posted last, as its fields.
pub async fn read_last_ipn(fixture: &NotificationFixture) -> BTreeMap<String, String> {
    fixture.run_due().await;
    let sent_requests = fixture.sent_requests();
    let last_ipn = sent_requests
        .last()
        .unwrap_or_else(|| panic!("an IPN was sent"));
    assert_eq!(
        last_ipn.headers.get("content-type").map(String::as_str),
        Some("application/x-www-form-urlencoded")
    );
    read_form(&last_ipn.body)
}

/// SSLCommerz's refund and transaction query API with the given fields and the store's
/// credentials.
pub async fn call_merchant_api(app_router: &axum::Router, query_fields: &[(&str, &str)]) -> Value {
    let mut request_fields = vec![
        ("store_id", STORE_ID),
        ("store_passwd", STORE_PASSWORD),
        ("format", "json"),
    ];
    request_fields.extend_from_slice(query_fields);
    let query = serde_urlencoded::to_string(&request_fields).unwrap_or_default();
    let merchant_request = Request::builder()
        .method("GET")
        .uri(format!(
            "{SSLCOMMERZ_PATH}/validator/api/merchantTransIDvalidationAPI.php?{query}"
        ))
        .body(Body::empty())
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let (status, merchant_answer) = send_request(app_router.clone(), merchant_request).await;
    assert_eq!(status, 200, "{merchant_answer}");
    merchant_answer
}
