#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod payment_notification_fixture;
    pub mod scripted_webhook_sender;
    pub mod stripe_requests;
    pub mod test_app;
}

use serde_json::{Value, json};
use support::payment_notification_fixture::{NotificationFixture, build_fixture};
use support::scripted_webhook_sender::ScriptedWebhookSender;
use support::stripe_requests::{call_stripe, create_payment_intent, find_payment, read_text};
use support::test_app::call_api;

const SESSION_FORM: &str = "mode=payment\
    &success_url=https://shop.test/thanks?session_id={CHECKOUT_SESSION_ID}\
    &cancel_url=https://shop.test/cart&client_reference_id=order-7\
    &line_items[0][quantity]=1&line_items[0][price_data][currency]=usd\
    &line_items[0][price_data][unit_amount]=1500&line_items[0][price_data][product_data][name]=T-shirt";

async fn build_stripe_fixture() -> NotificationFixture {
    build_fixture(ScriptedWebhookSender::default(), &["stripe"]).await
}

/// Each Stripe event sent so far, parsed, in the order they were sent.
async fn read_sent_events(fixture: &NotificationFixture) -> Vec<Value> {
    fixture.run_due().await;
    fixture
        .sent_requests()
        .iter()
        .map(|sent_request| serde_json::from_str(&sent_request.body).unwrap_or(Value::Null))
        .collect()
}

fn find_event<'events>(sent_events: &'events [Value], event_type: &str) -> &'events Value {
    sent_events
        .iter()
        .rev()
        .find(|sent_event| sent_event["type"] == event_type)
        .unwrap_or_else(|| panic!("a {event_type} event in {sent_events:?}"))
}

async fn retrieve(fixture: &NotificationFixture, path: &str) -> Value {
    call_stripe(&fixture.app_router, "GET", path, "").await.body
}

// AC: PY-04.4
#[tokio::test]
async fn a_paid_checkout_session_sends_the_session_and_its_payment_intent_as_the_api_answers_them()
{
    let fixture = build_stripe_fixture().await;
    let session = call_stripe(
        &fixture.app_router,
        "POST",
        "/checkout/sessions",
        SESSION_FORM,
    )
    .await;
    let checkout_url = read_text(&session.body["url"]);
    let payment_id = checkout_url.rsplit('/').next().unwrap_or_default();
    fixture.pay_with_test_card(payment_id).await;

    let sent_events = read_sent_events(&fixture).await;

    let session_id = read_text(&session.body["id"]);
    let completed = find_event(&sent_events, "checkout.session.completed");
    assert!(read_text(&completed["id"]).starts_with("evt_"));
    assert_eq!(completed["object"], "event");
    assert_eq!(completed["api_version"], "2025-03-31.basil");
    assert_eq!(completed["livemode"], false);
    assert_eq!(completed["pending_webhooks"], 1);
    assert_eq!(
        completed["request"],
        json!({"id": null, "idempotency_key": null})
    );
    let session_path = format!("/checkout/sessions/{session_id}");
    assert_eq!(
        completed["data"]["object"],
        retrieve(&fixture, &session_path).await
    );
    assert_eq!(
        completed["data"]["object"]["client_reference_id"],
        "order-7"
    );
    assert_eq!(completed["data"]["object"]["payment_status"], "paid");
    let intent_id = read_text(&completed["data"]["object"]["payment_intent"]);
    let succeeded = find_event(&sent_events, "payment_intent.succeeded");
    let intent_path = format!("/payment_intents/{intent_id}");
    assert_eq!(
        succeeded["data"]["object"],
        retrieve(&fixture, &intent_path).await
    );
    assert_eq!(succeeded["data"]["object"]["status"], "succeeded");
    assert_ne!(succeeded["id"], completed["id"]);
}

// AC: PY-04.4
#[tokio::test]
async fn a_declined_confirm_sends_payment_failed_with_the_last_payment_error() {
    let fixture = build_stripe_fixture().await;
    let created = create_payment_intent(&fixture.app_router, "").await;
    let intent_id = read_text(&created.body["id"]);

    let declined = call_stripe(
        &fixture.app_router,
        "POST",
        &format!("/payment_intents/{intent_id}/confirm"),
        "payment_method=pm_card_visa_chargeDeclinedInsufficientFunds",
    )
    .await;

    assert_eq!(declined.status, 402, "{}", declined.body);
    let sent_events = read_sent_events(&fixture).await;
    let failed = find_event(&sent_events, "payment_intent.payment_failed");
    let failed_intent = &failed["data"]["object"];
    assert_eq!(failed_intent["id"], intent_id.as_str());
    assert_eq!(failed_intent["status"], "requires_payment_method");
    assert_eq!(failed_intent["last_payment_error"]["code"], "card_declined");
    assert_eq!(
        failed_intent["last_payment_error"]["decline_code"],
        "insufficient_funds"
    );
    let intent_path = format!("/payment_intents/{intent_id}");
    assert_eq!(*failed_intent, retrieve(&fixture, &intent_path).await);
}

#[tokio::test]
async fn a_canceled_payment_intent_event_carries_the_cancellation_reason_it_was_sent() {
    let fixture = build_stripe_fixture().await;
    let created = create_payment_intent(&fixture.app_router, "metadata[order_id]=9").await;
    let intent_id = read_text(&created.body["id"]);

    call_stripe(
        &fixture.app_router,
        "POST",
        &format!("/payment_intents/{intent_id}/cancel"),
        "cancellation_reason=requested_by_customer",
    )
    .await;

    let sent_events = read_sent_events(&fixture).await;
    let canceled = &find_event(&sent_events, "payment_intent.canceled")["data"]["object"];
    assert_eq!(canceled["cancellation_reason"], "requested_by_customer");
    assert_eq!(canceled["metadata"], json!({"order_id": "9"}));
    let intent_path = format!("/payment_intents/{intent_id}");
    assert_eq!(*canceled, retrieve(&fixture, &intent_path).await);
}

#[tokio::test]
async fn a_refund_sends_the_charge_and_a_dispute_sends_the_dispute() {
    let fixture = build_stripe_fixture().await;
    let paid = create_payment_intent(
        &fixture.app_router,
        "confirm=true&payment_method=pm_card_visa",
    )
    .await;
    let intent_id = read_text(&paid.body["id"]);
    call_stripe(
        &fixture.app_router,
        "POST",
        "/refunds",
        &format!("payment_intent={intent_id}&amount=500"),
    )
    .await;
    let payment_id = read_text(&find_payment(&fixture.app_router, &intent_id).await["id"]);
    let (status, _) = call_api(
        &fixture.app_router,
        "POST",
        &format!("/api/v1/payments/{payment_id}/simulate"),
        Some(&json!({ "action": "dispute" })),
    )
    .await;
    assert_eq!(status, 200);

    let sent_events = read_sent_events(&fixture).await;

    let charge_id = intent_id.replacen("pi_", "ch_", 1);
    let refunded = &find_event(&sent_events, "charge.refunded")["data"]["object"];
    assert_eq!(refunded["id"], charge_id.as_str());
    assert_eq!(refunded["object"], "charge");
    assert_eq!(refunded["amount_refunded"], 500);
    assert_eq!(refunded["refunded"], false);
    assert_eq!(refunded["payment_intent"], intent_id.as_str());
    assert!(refunded.get("refunds").is_none());
    let disputed = &find_event(&sent_events, "charge.dispute.created")["data"]["object"];
    assert_eq!(disputed["object"], "dispute");
    assert_eq!(disputed["id"], intent_id.replacen("pi_", "dp_", 1).as_str());
    assert_eq!(disputed["charge"], charge_id.as_str());
    assert_eq!(disputed["status"], "needs_response");
}
