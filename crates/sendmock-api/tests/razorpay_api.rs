#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod payment_notification_fixture;
    pub mod scripted_webhook_sender;
    pub mod sslcommerz_requests;
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use sendmock_payments::sign_razorpay_payload;
use serde_json::{Value, json};
use support::payment_notification_fixture::{NotificationFixture, build_fixture};
use support::scripted_webhook_sender::ScriptedWebhookSender;
use support::sslcommerz_requests::{
    complete_checkout, pay_with_card, read_redirect_fields, send_request,
};

const RAZORPAY_PATH: &str = "/providers/razorpay/v1";
const KEY_ID: &str = "rzp_test_SendMock0001";
const KEY_SECRET: &str = "sendmockRazorpayKeySecret01";
const WEBHOOK_SECRET: &str = "sendmock_razorpay_webhook_secret";
const CALLBACK_URL: &str = "https://shop.example/razorpay/callback";

/// A call as the official SDK makes it: JSON with Basic auth of the key id and secret.
async fn call_razorpay(
    app_router: &axum::Router,
    method: &str,
    api_path: &str,
    body: Option<&Value>,
    key_secret: &str,
) -> (u16, Value) {
    let basic_pair = STANDARD.encode(format!("{KEY_ID}:{key_secret}"));
    let request = Request::builder()
        .method(method)
        .uri(format!("{RAZORPAY_PATH}{api_path}"))
        .header("authorization", format!("Basic {basic_pair}"))
        .header("content-type", "application/json")
        .body(body.map_or_else(Body::empty, |body| Body::from(body.to_string())))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    send_request(app_router.clone(), request).await
}

/// A GET the SDK makes, answering the body.
async fn get_razorpay(app_router: &axum::Router, api_path: &str) -> Value {
    call_razorpay(app_router, "GET", api_path, None, KEY_SECRET)
        .await
        .1
}

async fn create_order(app_router: &axum::Router, changed_fields: &Value) -> Value {
    let mut order_fields = json!({
        "amount": 50_000, "currency": "INR", "receipt": "receipt#1",
        "notes": { "callback_url": CALLBACK_URL, "cart": "42" },
    });
    if let (Some(fields), Some(changes)) =
        (order_fields.as_object_mut(), changed_fields.as_object())
    {
        fields.extend(changes.clone());
    }
    let (status, order) = call_razorpay(
        app_router,
        "POST",
        "/orders",
        Some(&order_fields),
        KEY_SECRET,
    )
    .await;
    assert_eq!(status, 200, "{order}");
    order
}

/// The SendMock payment behind an order, whose checkout page pays it.
async fn find_checkout_id(fixture: &NotificationFixture, order_id: &str) -> String {
    let (_, payments) = support::test_app::call_api(
        &fixture.app_router,
        "GET",
        "/api/v1/payments?provider=razorpay",
        None,
    )
    .await;
    payments["items"]
        .as_array()
        .into_iter()
        .flatten()
        .find(|payment| payment["provider_reference"] == order_id)
        .and_then(|payment| payment["id"].as_str())
        .unwrap_or_default()
        .to_owned()
}

async fn create_and_pay(fixture: &NotificationFixture, changed_fields: &Value) -> (Value, Value) {
    let order = create_order(&fixture.app_router, changed_fields).await;
    let checkout_id = find_checkout_id(fixture, order["id"].as_str().unwrap_or_default()).await;
    let session = complete_checkout(
        &fixture.app_router,
        &checkout_id,
        pay_with_card("4242424242424242"),
    )
    .await;
    (order, session)
}

async fn build_razorpay_fixture() -> NotificationFixture {
    build_fixture(ScriptedWebhookSender::default(), &["razorpay"]).await
}

// AC: PY-10.2
#[tokio::test]
async fn orders_are_created_with_the_key_and_refused_in_razorpays_shape() {
    let fixture = build_razorpay_fixture().await;

    let order = create_order(&fixture.app_router, &json!({})).await;
    let (wrong_key_status, wrong_key) = call_razorpay(
        &fixture.app_router,
        "POST",
        "/orders",
        Some(&json!({ "amount": 50_000, "currency": "INR" })),
        "guess",
    )
    .await;
    let (small_status, too_small) = call_razorpay(
        &fixture.app_router,
        "POST",
        "/orders",
        Some(&json!({ "amount": 50, "currency": "INR" })),
        KEY_SECRET,
    )
    .await;
    let (missing_status, missing) = call_razorpay(
        &fixture.app_router,
        "GET",
        "/orders/order_missing",
        None,
        KEY_SECRET,
    )
    .await;

    assert!(
        order["id"]
            .as_str()
            .is_some_and(|order_id| order_id.starts_with("order_")),
        "{order}"
    );
    assert_eq!(order["entity"], "order");
    assert_eq!(order["status"], "created");
    assert_eq!(order["amount_due"], 50_000);
    assert_eq!(order["receipt"], "receipt#1");
    assert_eq!(order["notes"]["cart"], "42");
    assert_eq!(wrong_key_status, 401);
    assert_eq!(wrong_key["error"]["description"], "Authentication failed");
    assert_eq!(small_status, 400);
    assert_eq!(too_small["error"]["code"], "BAD_REQUEST_ERROR");
    assert_eq!(too_small["error"]["field"], "amount");
    assert_eq!(missing_status, 400);
    assert_eq!(
        missing["error"]["description"],
        "The id provided does not exist"
    );
}

// AC: PY-10.2
#[tokio::test]
async fn a_paid_order_posts_a_razorpay_signature_the_key_secret_verifies() {
    let fixture = build_razorpay_fixture().await;

    let (order, session) = create_and_pay(&fixture, &json!({})).await;

    let order_id = order["id"].as_str().unwrap_or_default();
    let redirect_fields = read_redirect_fields(&session);
    let payment_id = redirect_fields
        .get("razorpay_payment_id")
        .cloned()
        .unwrap_or_default();
    assert_eq!(session["redirect"]["url"], CALLBACK_URL);
    assert_eq!(session["redirect"]["method"], "POST");
    assert_eq!(
        redirect_fields.get("razorpay_order_id").map(String::as_str),
        Some(order_id)
    );
    assert_eq!(
        redirect_fields.get("razorpay_signature"),
        Some(&sign_razorpay_payload(
            KEY_SECRET,
            &format!("{order_id}|{payment_id}")
        ))
    );
    let paid_order = get_razorpay(&fixture.app_router, &format!("/orders/{order_id}")).await;
    let order_payments =
        get_razorpay(&fixture.app_router, &format!("/orders/{order_id}/payments")).await;
    let payment = get_razorpay(&fixture.app_router, &format!("/payments/{payment_id}")).await;
    assert_eq!(paid_order["status"], "paid");
    assert_eq!(paid_order["amount_paid"], 50_000);
    assert_eq!(order_payments["count"], 1);
    assert_eq!(payment["status"], "captured", "{payment}");
    assert_eq!(payment["captured"], true);
    assert_eq!(payment["order_id"], order_id);
}

// AC: PY-10.2
#[tokio::test]
async fn an_order_without_auto_capture_waits_for_the_full_capture() {
    let fixture = build_razorpay_fixture().await;
    let (_, session) = create_and_pay(&fixture, &json!({ "payment_capture": 0 })).await;
    let payment_id = read_redirect_fields(&session)
        .get("razorpay_payment_id")
        .cloned()
        .unwrap_or_default();
    let capture_path = format!("/payments/{payment_id}/capture");

    let authorized = get_razorpay(&fixture.app_router, &format!("/payments/{payment_id}")).await;
    let (part_status, part) = call_razorpay(
        &fixture.app_router,
        "POST",
        &capture_path,
        Some(&json!({ "amount": 100, "currency": "INR" })),
        KEY_SECRET,
    )
    .await;
    let (status, captured) = call_razorpay(
        &fixture.app_router,
        "POST",
        &capture_path,
        Some(&json!({ "amount": 50_000, "currency": "INR" })),
        KEY_SECRET,
    )
    .await;
    let (again_status, again) = call_razorpay(
        &fixture.app_router,
        "POST",
        &capture_path,
        Some(&json!({ "amount": 50_000, "currency": "INR" })),
        KEY_SECRET,
    )
    .await;

    assert_eq!(authorized["status"], "authorized", "{authorized}");
    assert_eq!(part_status, 400, "{part}");
    assert_eq!(status, 200, "{captured}");
    assert_eq!(captured["status"], "captured");
    assert_eq!(again_status, 400);
    assert_eq!(
        again["error"]["description"],
        "This payment has already been captured"
    );
}

// AC: PY-10.2
#[tokio::test]
async fn refunds_are_processed_in_part_and_listed_by_payment() {
    let fixture = build_razorpay_fixture().await;
    let (_, session) = create_and_pay(&fixture, &json!({})).await;
    let payment_id = read_redirect_fields(&session)
        .get("razorpay_payment_id")
        .cloned()
        .unwrap_or_default();
    let refund_path = format!("/payments/{payment_id}/refund");

    let (status, refund) = call_razorpay(
        &fixture.app_router,
        "POST",
        &refund_path,
        Some(&json!({ "amount": 20_000, "notes": { "reason": "broken" } })),
        KEY_SECRET,
    )
    .await;
    let (too_much_status, too_much) = call_razorpay(
        &fixture.app_router,
        "POST",
        &refund_path,
        Some(&json!({ "amount": 40_000 })),
        KEY_SECRET,
    )
    .await;
    let refund_id = refund["id"].as_str().unwrap_or_default();
    let fetched = get_razorpay(&fixture.app_router, &format!("/refunds/{refund_id}")).await;
    let listed = get_razorpay(
        &fixture.app_router,
        &format!("/payments/{payment_id}/refunds"),
    )
    .await;
    let payment = get_razorpay(&fixture.app_router, &format!("/payments/{payment_id}")).await;

    assert_eq!(status, 200, "{refund}");
    assert!(refund_id.starts_with("rfnd_"));
    assert_eq!(refund["status"], "processed");
    assert_eq!(refund["payment_id"], payment_id.as_str());
    assert_eq!(too_much_status, 400, "{too_much}");
    assert_eq!(too_much["error"]["field"], "amount");
    assert_eq!(fetched["amount"], 20_000, "{fetched}");
    assert_eq!(listed["count"], 1);
    assert_eq!(payment["refund_status"], "partial");
    assert_eq!(payment["amount_refunded"], 20_000);
}

fn find_webhook(fixture: &NotificationFixture, event_name: &str) -> (Value, String, String) {
    let sent_request = fixture
        .sent_requests()
        .into_iter()
        .find(|sent_request| {
            sent_request
                .body
                .contains(&format!("\"event\":\"{event_name}\""))
                || sent_request
                    .body
                    .contains(&format!("\"event\": \"{event_name}\""))
        })
        .unwrap_or_else(|| panic!("a {event_name} webhook was sent"));
    let signature = sent_request
        .headers
        .get("x-razorpay-signature")
        .cloned()
        .unwrap_or_default();
    let webhook: Value = serde_json::from_str(&sent_request.body).unwrap_or(Value::Null);
    (webhook, signature, sent_request.body)
}

// AC: PY-10.2
#[tokio::test]
async fn webhooks_carry_razorpays_payloads_and_a_signature_the_webhook_secret_verifies() {
    let fixture = build_razorpay_fixture().await;
    let (order, session) = create_and_pay(&fixture, &json!({})).await;
    let payment_id = read_redirect_fields(&session)
        .get("razorpay_payment_id")
        .cloned()
        .unwrap_or_default();
    call_razorpay(
        &fixture.app_router,
        "POST",
        &format!("/payments/{payment_id}/refund"),
        Some(&json!({})),
        KEY_SECRET,
    )
    .await;

    fixture.run_due().await;

    let (captured, captured_signature, captured_body) = find_webhook(&fixture, "payment.captured");
    assert_eq!(
        captured_signature,
        sign_razorpay_payload(WEBHOOK_SECRET, &captured_body)
    );
    assert_eq!(captured["entity"], "event");
    assert_eq!(captured["contains"], json!(["payment"]));
    assert_eq!(
        captured["payload"]["payment"]["entity"]["id"],
        payment_id.as_str()
    );
    let (order_paid, _, _) = find_webhook(&fixture, "order.paid");
    assert_eq!(order_paid["payload"]["order"]["entity"]["id"], order["id"]);
    let (refunded, _, _) = find_webhook(&fixture, "refund.processed");
    assert_eq!(refunded["contains"], json!(["refund", "payment"]));
    assert_eq!(refunded["payload"]["refund"]["entity"]["amount"], 50_000);
}
