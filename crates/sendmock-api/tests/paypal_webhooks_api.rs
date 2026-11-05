#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod payment_notification_fixture;
    pub mod paypal_requests;
    pub mod scripted_webhook_sender;
    pub mod test_app;
}

use axum::http::Request;
use sendmock_ops::RecordedHttpRequest;
use serde_json::{Value, json};
use support::payment_notification_fixture::{NotificationFixture, build_fixture};
use support::paypal_requests::{
    PAYPAL_PATH, PayPalReply, act_on_page, call_paypal, create_order, read_issue, read_text,
    send_paypal_request,
};
use support::scripted_webhook_sender::ScriptedWebhookSender;
use support::test_app::call_api;

const VERIFY_PATH: &str = "/v1/notifications/verify-webhook-signature";

async fn build_paypal_fixture() -> NotificationFixture {
    build_fixture(ScriptedWebhookSender::default(), &["paypal"]).await
}

/// Each PayPal event sent so far with the request that carried it, oldest first.
async fn read_sent_events(fixture: &NotificationFixture) -> Vec<(RecordedHttpRequest, Value)> {
    fixture.run_due().await;
    fixture
        .sent_requests()
        .into_iter()
        .map(|sent_request| {
            let sent_event = serde_json::from_str(&sent_request.body).unwrap_or(Value::Null);
            (sent_request, sent_event)
        })
        .collect()
}

fn find_event(
    sent_events: &[(RecordedHttpRequest, Value)],
    event_type: &str,
) -> (RecordedHttpRequest, Value) {
    sent_events
        .iter()
        .rev()
        .find(|(_, sent_event)| sent_event["event_type"] == event_type)
        .cloned()
        .unwrap_or_else(|| panic!("a {event_type} event in {sent_events:?}"))
}

/// An order for 25.00 USD the payer approved on the checkout page.
async fn approve_order(fixture: &NotificationFixture) -> String {
    let order = create_order(&fixture.app_router).await.body;
    act_on_page(&fixture.app_router, &order, "pay").await;
    read_text(&order["id"])
}

async fn capture_order(fixture: &NotificationFixture, order_id: &str) -> String {
    let capture_path = format!("/v2/checkout/orders/{order_id}/capture");
    let captured = call_paypal(&fixture.app_router, "POST", &capture_path, None).await;
    assert_eq!(captured.status, 201, "{}", captured.body);
    read_text(&captured.body["purchase_units"][0]["payments"]["captures"][0]["id"])
}

async fn retrieve(fixture: &NotificationFixture, path: &str) -> Value {
    call_paypal(&fixture.app_router, "GET", path, None)
        .await
        .body
}

/// The webhook id an app configures: the gateway's notification endpoint's id.
async fn read_webhook_id(fixture: &NotificationFixture) -> String {
    let (_, paypal_gateway) = call_api(
        &fixture.app_router,
        "GET",
        "/api/v1/payments/gateways/paypal",
        None,
    )
    .await;
    read_text(&paypal_gateway["notification_endpoint_id"])
}

/// The check an app makes for a delivery it received, as PayPal's docs show it.
fn describe_delivery(sent_request: &RecordedHttpRequest, webhook_id: &str) -> Value {
    let read_header = |header_name: &str| {
        sent_request
            .headers
            .iter()
            .find(|(sent_name, _)| sent_name.eq_ignore_ascii_case(header_name))
            .map(|(_, header_value)| header_value.clone())
            .unwrap_or_default()
    };
    json!({
        "auth_algo": read_header("paypal-auth-algo"),
        "cert_url": read_header("paypal-cert-url"),
        "transmission_id": read_header("paypal-transmission-id"),
        "transmission_sig": read_header("paypal-transmission-sig"),
        "transmission_time": read_header("paypal-transmission-time"),
        "webhook_id": webhook_id,
        "webhook_event": serde_json::from_str::<Value>(&sent_request.body).unwrap_or(Value::Null),
    })
}

async fn verify(fixture: &NotificationFixture, verification_request: &Value) -> PayPalReply {
    call_paypal(
        &fixture.app_router,
        "POST",
        VERIFY_PATH,
        Some(verification_request),
    )
    .await
}

// AC: PY-05.2
#[tokio::test]
async fn an_approved_order_is_sent_as_the_api_answers_it_with_paypal_transmission_headers() {
    let fixture = build_paypal_fixture().await;
    let order_id = approve_order(&fixture).await;

    let sent_events = read_sent_events(&fixture).await;

    let (sent_request, approved) = find_event(&sent_events, "CHECKOUT.ORDER.APPROVED");
    assert!(read_text(&approved["id"]).starts_with("WH-"));
    assert_eq!(approved["event_version"], "1.0");
    assert_eq!(approved["resource_type"], "checkout-order");
    assert_eq!(approved["resource_version"], "2.0");
    assert_eq!(approved["summary"], "An order has been approved by buyer");
    let order_path = format!("/v2/checkout/orders/{order_id}");
    assert_eq!(approved["resource"], retrieve(&fixture, &order_path).await);
    assert_eq!(approved["resource"]["status"], "APPROVED");
    let transmission_id = &sent_request.headers["paypal-transmission-id"];
    assert_eq!(transmission_id.len(), 36, "a UUID: {transmission_id}");
    assert!(!sent_request.headers["paypal-transmission-time"].is_empty());
    assert_eq!(sent_request.headers["paypal-transmission-sig"].len(), 344);
    assert!(sent_request.headers["paypal-cert-url"].contains("/v1/notifications/certs/"));
    assert_eq!(sent_request.headers["paypal-auth-algo"], "SHA256withRSA");
    let event_types: Vec<&Value> = sent_events
        .iter()
        .map(|(_, sent_event)| &sent_event["event_type"])
        .collect();
    assert!(
        !event_types
            .iter()
            .any(|event_type| read_text(event_type).starts_with("PAYMENT.AUTHORIZATION.")),
        "Orders with intent CAPTURE send no authorization events: {event_types:?}"
    );
}

// AC: PY-05.2
#[tokio::test]
async fn a_capture_and_a_refund_are_sent_as_the_api_answers_them() {
    let fixture = build_paypal_fixture().await;
    let order_id = approve_order(&fixture).await;
    let capture_id = capture_order(&fixture, &order_id).await;
    let refund_path = format!("/v2/payments/captures/{capture_id}/refund");
    let refund_body = json!({"amount": {"currency_code": "USD", "value": "10.00"}});
    let refunded = call_paypal(
        &fixture.app_router,
        "POST",
        &refund_path,
        Some(&refund_body),
    )
    .await;

    let sent_events = read_sent_events(&fixture).await;

    let (_, completed) = find_event(&sent_events, "PAYMENT.CAPTURE.COMPLETED");
    assert_eq!(completed["resource_type"], "capture");
    assert_eq!(completed["summary"], "Payment completed");
    let completed_capture = &completed["resource"];
    assert_eq!(completed_capture["id"], capture_id.as_str());
    assert_eq!(completed_capture["status"], "COMPLETED");
    assert_eq!(
        completed_capture["supplementary_data"]["related_ids"]["order_id"],
        order_id.as_str()
    );
    let (_, refund_event) = find_event(&sent_events, "PAYMENT.CAPTURE.REFUNDED");
    assert_eq!(refund_event["resource_type"], "refund");
    let refund_id = read_text(&refunded.body["id"]);
    let retrieved_refund = retrieve(&fixture, &format!("/v2/payments/refunds/{refund_id}")).await;
    assert_eq!(refund_event["resource"], retrieved_refund);
    assert_eq!(refund_event["resource"]["amount"]["value"], "10.00");
}

// AC: PY-05.2
#[tokio::test]
async fn verify_webhook_signature_answers_success_for_a_genuine_delivery_and_failure_for_an_altered_one()
 {
    let fixture = build_paypal_fixture().await;
    approve_order(&fixture).await;
    let sent_events = read_sent_events(&fixture).await;
    let (sent_request, _) = find_event(&sent_events, "CHECKOUT.ORDER.APPROVED");
    let webhook_id = read_webhook_id(&fixture).await;
    let genuine = describe_delivery(&sent_request, &webhook_id);
    let mut reordered_event = genuine.clone();
    let event_text = serde_json::to_string_pretty(&genuine["webhook_event"]).unwrap_or_default();
    reordered_event["webhook_event"] = serde_json::from_str(&event_text).unwrap_or(Value::Null);
    let mut altered_amount = genuine.clone();
    altered_amount["webhook_event"]["resource"]["purchase_units"][0]["amount"]["value"] =
        json!("1.00");
    let mut other_webhook = genuine.clone();
    other_webhook["webhook_id"] = json!("8PT597110X687430LKGECATA");
    let mut forged_signature = genuine.clone();
    forged_signature["transmission_sig"] = json!("forged");
    let mut unknown_transmission = genuine.clone();
    unknown_transmission["transmission_id"] = json!("69cd13f0-d67a-11e5-baa3-778b53f4ae55");

    let status_of = |paypal_reply: PayPalReply| {
        assert_eq!(paypal_reply.status, 200, "{}", paypal_reply.body);
        paypal_reply.body["verification_status"].clone()
    };
    assert_eq!(status_of(verify(&fixture, &genuine).await), "SUCCESS");
    assert_eq!(
        status_of(verify(&fixture, &reordered_event).await),
        "SUCCESS"
    );
    for altered in [
        altered_amount,
        other_webhook,
        forged_signature,
        unknown_transmission,
    ] {
        assert_eq!(status_of(verify(&fixture, &altered).await), "FAILURE");
    }
}

// AC: PY-05.2
#[tokio::test]
async fn verify_webhook_signature_needs_every_field_and_paypal_credentials() {
    let fixture = build_paypal_fixture().await;
    let mut incomplete = describe_delivery(&RecordedHttpRequest::empty_post(), "WEBHOOK1");
    incomplete["transmission_id"] = json!("69cd13f0-d67a-11e5-baa3-778b53f4ae55");
    incomplete["auth_algo"] = json!("SHA256withRSA");
    incomplete["cert_url"] = json!("https://api.sandbox.paypal.com/v1/notifications/certs/CERT");
    incomplete["transmission_time"] = json!("2026-11-05T10:00:00Z");

    let refused = verify(&fixture, &incomplete).await;
    let anonymous = send_paypal_request(
        &fixture.app_router,
        Request::builder()
            .method("POST")
            .uri(format!("{PAYPAL_PATH}{VERIFY_PATH}"))
            .header("content-type", "application/json"),
        incomplete.to_string(),
    )
    .await;

    assert_eq!(refused.status, 400, "{}", refused.body);
    assert_eq!(refused.body["name"], "INVALID_REQUEST");
    assert_eq!(read_issue(&refused), "MISSING_REQUIRED_PARAMETER");
    assert_eq!(refused.body["details"][0]["field"], "/transmission_sig");
    assert_eq!(anonymous.status, 401);
    assert_eq!(anonymous.body["name"], "AUTHENTICATION_FAILURE");
}

async fn simulate(fixture: &NotificationFixture, payment_id: &str, simulate_body: Value) {
    let (status, simulated) = call_api(
        &fixture.app_router,
        "POST",
        &format!("/api/v1/payments/{payment_id}/simulate"),
        Some(&simulate_body),
    )
    .await;
    assert_eq!(status, 200, "{simulated}");
}

// AC: PY-05.2
#[tokio::test]
async fn a_payment_made_without_the_orders_api_sends_its_capture_and_its_dispute() {
    let fixture = build_paypal_fixture().await;
    let payment_id = fixture.create_checkout("paypal").await;
    let (status, paid) = call_api(
        &fixture.app_router,
        "POST",
        &format!("/api/v1/checkout-sessions/{payment_id}/complete"),
        Some(&json!({"action": "pay", "method_key": "paypal_account"})),
    )
    .await;
    assert_eq!(status, 200, "{paid}");
    simulate(&fixture, &payment_id, json!({"action": "dispute"})).await;
    let won = json!({"action": "resolve_dispute", "dispute_outcome": "won"});
    simulate(&fixture, &payment_id, won).await;

    let sent_events = read_sent_events(&fixture).await;

    let (_, completed) = find_event(&sent_events, "PAYMENT.CAPTURE.COMPLETED");
    let capture_id = read_text(&completed["resource"]["id"]);
    assert_eq!(capture_id.len(), 17, "{capture_id}");
    assert_eq!(completed["resource"]["amount"]["value"], "12.00");
    let (_, opened) = find_event(&sent_events, "CUSTOMER.DISPUTE.CREATED");
    assert_eq!(opened["resource_type"], "dispute");
    let opened_dispute = &opened["resource"];
    assert_eq!(opened_dispute["dispute_id"], format!("PP-D-{capture_id}"));
    assert_eq!(opened_dispute["status"], "OPEN");
    assert_eq!(opened_dispute["reason"], "UNAUTHORISED");
    assert_eq!(
        opened_dispute["disputed_transactions"][0]["seller_transaction_id"],
        capture_id.as_str()
    );
    assert!(opened_dispute.get("dispute_outcome").is_none());
    let (_, resolved) = find_event(&sent_events, "CUSTOMER.DISPUTE.RESOLVED");
    assert_eq!(resolved["resource"]["status"], "RESOLVED");
    assert_eq!(
        resolved["resource"]["dispute_outcome"]["outcome_code"],
        "RESOLVED_SELLER_FAVOUR"
    );
}
