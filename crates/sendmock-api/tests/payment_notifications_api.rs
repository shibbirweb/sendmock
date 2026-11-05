#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod payment_notification_fixture;
    pub mod scripted_webhook_sender;
    pub mod test_app;
}

use serde_json::json;
use support::payment_notification_fixture::{build_fixture, find_sent_body};
use support::scripted_webhook_sender::{ScriptedAnswer, ScriptedWebhookSender};
use support::test_app::call_api;

// AC: PY-08.3
#[tokio::test]
async fn a_paid_stripe_checkout_sends_stripe_signed_notifications_to_the_gateway_endpoint() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), &["stripe"]).await;
    let payment_id = fixture.create_checkout("stripe").await;
    fixture.pay_with_test_card(&payment_id).await;

    fixture.run_due().await;

    let sent_requests = fixture.sent_requests();
    assert_eq!(sent_requests.len(), 3, "{sent_requests:?}");
    let succeeded = find_sent_body(&sent_requests, "\"payment_intent.succeeded\"");
    assert_eq!(succeeded.url, "http://localhost:3000/payments/ipn");
    assert_eq!(succeeded.headers["content-type"], "application/json");
    assert!(succeeded.headers["stripe-signature"].starts_with("t=1767225600,v1="));
    assert!(!succeeded.headers.contains_key("webhook-signature"));
    find_sent_body(&sent_requests, "\"checkout.session.completed\"");
    let payment = fixture.read_payment(&payment_id).await;
    let notifications = payment["notifications"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let provider_event_names: Vec<&str> = notifications
        .iter()
        .filter_map(|notification| notification["provider_event_name"].as_str())
        .collect();
    assert_eq!(
        provider_event_names,
        [
            "payment_intent.created",
            "checkout.session.completed",
            "payment_intent.succeeded"
        ]
    );
    assert!(notifications.iter().all(|notification| {
        notification["status"] == "succeeded" && notification["status_code"] == 200
    }));
    assert!(payment["timeline"].as_array().is_some_and(|timeline| {
        timeline.iter().any(|timeline_event| {
            timeline_event["description"] == "Sent payment_intent.succeeded to Shop payments"
        })
    }));
    let (_, logged) = call_api(
        &fixture.app_router,
        "GET",
        "/api/v1/webhooks/deliveries?event_type=payment.succeeded",
        None,
    )
    .await;
    assert_eq!(logged["items"][0]["endpoint_name"], "Shop payments");
}

// AC: PY-08.3, PY-03.1
#[tokio::test]
async fn a_failed_notification_is_retried_and_the_payment_shows_each_outcome() {
    let webhook_sender = ScriptedWebhookSender::answering(&[ScriptedAnswer::Status(500)]);
    let fixture = build_fixture(webhook_sender, &["sslcommerz"]).await;
    let payment_id = fixture.create_checkout("sslcommerz").await;
    call_api(
        &fixture.app_router,
        "POST",
        &format!("/api/v1/checkout-sessions/{payment_id}/complete"),
        Some(&json!({ "action": "decline", "decline_reason": "insufficient_funds" })),
    )
    .await;

    fixture.run_due().await;
    let after_failure = fixture.read_payment(&payment_id).await;
    fixture.manual_clock.advance_ms(1_000);
    fixture.run_due().await;
    let after_retry = fixture.read_payment(&payment_id).await;

    assert_eq!(
        after_failure["notifications"][0]["provider_event_name"],
        "FAILED"
    );
    assert_eq!(after_failure["notifications"][0]["status"], "failed");
    assert_eq!(after_failure["notifications"][0]["status_code"], 500);
    assert_eq!(after_retry["notifications"][0]["status"], "succeeded");
    let sent_requests = fixture.sent_requests();
    assert_eq!(sent_requests.len(), 2);
    let form_notification = &sent_requests[1];
    assert_eq!(
        form_notification.headers["content-type"],
        "application/x-www-form-urlencoded"
    );
    assert!(form_notification.body.contains("status=FAILED"));
    assert!(form_notification.body.contains("currency=USD"));
}

#[tokio::test]
async fn native_notifications_are_signed_with_standard_webhooks() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), &["native"]).await;
    fixture.create_checkout("native").await;

    fixture.run_due().await;

    let created = find_sent_body(&fixture.sent_requests(), "\"payment.created\"");
    assert!(created.headers.contains_key("webhook-signature"));
    assert!(created.headers.contains_key("webhook-id"));
}

// AC: PY-08.3
#[tokio::test]
async fn notify_resends_the_last_notification_as_a_new_delivery() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), &["stripe"]).await;
    let payment_id = fixture.create_checkout("stripe").await;
    let unnotified_id = fixture.create_checkout("paypal").await;
    let notify_path = |payment_id: &str| format!("/api/v1/payments/{payment_id}/notify");

    let (status, resent) =
        call_api(&fixture.app_router, "POST", &notify_path(&payment_id), None).await;
    let (refused_status, refusal) = call_api(
        &fixture.app_router,
        "POST",
        &notify_path(&unnotified_id),
        None,
    )
    .await;
    fixture.run_due().await;

    assert_eq!(status, 200, "{resent}");
    let notifications = resent["notifications"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    assert_eq!(notifications.len(), 2);
    assert_eq!(notifications[1]["event_type"], "payment.created");
    assert_ne!(
        notifications[0]["delivery_id"],
        notifications[1]["delivery_id"]
    );
    assert_eq!(fixture.sent_requests().len(), 2);
    assert_eq!(refused_status, 409);
    assert_eq!(refusal["error"]["code"], "nothing_to_resend");
}

#[tokio::test]
async fn a_replayed_notification_stays_unsigned_and_cannot_be_rendered_again() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), &["stripe"]).await;
    let payment_id = fixture.create_checkout("stripe").await;
    let payment = fixture.read_payment(&payment_id).await;
    let delivery_id = payment["notifications"][0]["delivery_id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let replay_path = format!("/api/v1/webhooks/deliveries/{delivery_id}/replay");

    let (status, replayed) = call_api(
        &fixture.app_router,
        "POST",
        &replay_path,
        Some(&json!({ "rerender": false })),
    )
    .await;
    let (rerender_status, rerender_refusal) = call_api(
        &fixture.app_router,
        "POST",
        &replay_path,
        Some(&json!({ "rerender": true })),
    )
    .await;
    fixture.run_due().await;

    assert_eq!(status, 200, "{replayed}");
    assert_eq!(rerender_status, 409);
    assert_eq!(rerender_refusal["error"]["code"], "gateway_notification");
    let sent_requests = fixture.sent_requests();
    assert_eq!(sent_requests.len(), 2);
    assert!(sent_requests.iter().all(|sent_request| {
        sent_request.headers.contains_key("stripe-signature")
            && !sent_request.headers.contains_key("webhook-signature")
    }));
}
