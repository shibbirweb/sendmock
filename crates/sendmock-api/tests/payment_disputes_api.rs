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
use serde_json::{Value, json};
use support::payment_notification_fixture::{NotificationFixture, build_fixture};
use support::scripted_webhook_sender::ScriptedWebhookSender;
use support::sslcommerz_requests::send_request;
use support::test_app::call_api;

async fn simulate(
    fixture: &NotificationFixture,
    payment_id: &str,
    simulate_request: Value,
) -> (u16, Value) {
    call_api(
        &fixture.app_router,
        "POST",
        &format!("/api/v1/payments/{payment_id}/simulate"),
        Some(&simulate_request),
    )
    .await
}

/// A paid payment of the gateway with an open dispute.
async fn open_dispute(fixture: &NotificationFixture, gateway_key: &str) -> String {
    let payment_id = fixture.create_checkout(gateway_key).await;
    let method_key = if gateway_key == "paypal" {
        "paypal_account"
    } else {
        "card"
    };
    let (pay_status, paid) = call_api(
        &fixture.app_router,
        "POST",
        &format!("/api/v1/checkout-sessions/{payment_id}/complete"),
        Some(&json!({ "action": "pay", "method_key": method_key,
                      "card": { "number": "4242424242424242", "exp_month": 12, "exp_year": 2030 } })),
    )
    .await;
    assert_eq!(pay_status, 200, "{paid}");
    let (status, disputed) = simulate(fixture, &payment_id, json!({ "action": "dispute" })).await;
    assert_eq!(status, 200, "{disputed}");
    payment_id
}

/// The notification bodies sent for this provider event, as JSON.
async fn read_notifications(fixture: &NotificationFixture, event_name: &str) -> Vec<Value> {
    fixture.run_due().await;
    fixture.run_due().await;
    fixture
        .sent_requests()
        .iter()
        .filter_map(|sent_request| serde_json::from_str::<Value>(&sent_request.body).ok())
        .filter(|notification| {
            notification["type"] == event_name || notification["event_type"] == event_name
        })
        .collect()
}

// AC: PY-07.3
#[tokio::test]
async fn a_dispute_is_answered_with_evidence_then_won_with_stripes_events() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), &["stripe"]).await;
    let payment_id = open_dispute(&fixture, "stripe").await;

    let (status, answered) = simulate(
        &fixture,
        &payment_id,
        json!({ "action": "answer_dispute", "dispute_evidence": "Signed delivery receipt." }),
    )
    .await;
    let (again_status, _) =
        simulate(&fixture, &payment_id, json!({ "action": "answer_dispute" })).await;
    let (won_status, won) = simulate(
        &fixture,
        &payment_id,
        json!({ "action": "resolve_dispute", "dispute_outcome": "won" }),
    )
    .await;

    assert_eq!(status, 200, "{answered}");
    assert_eq!(answered["dispute"]["status"], "under_review");
    assert_eq!(answered["dispute"]["evidence"], "Signed delivery receipt.");
    assert_eq!(again_status, 409);
    assert_eq!(won_status, 200, "{won}");
    assert_eq!(won["dispute"]["status"], "won");
    assert_eq!(won["status"], "succeeded");
    let updated = read_notifications(&fixture, "charge.dispute.updated").await;
    assert_eq!(updated.len(), 1, "{updated:?}");
    assert_eq!(updated[0]["data"]["object"]["status"], "under_review");
    assert_eq!(
        updated[0]["data"]["object"]["evidence_details"]["has_evidence"],
        true
    );
    assert_eq!(
        updated[0]["data"]["object"]["evidence"]["uncategorized_text"],
        "Signed delivery receipt."
    );
    let closed = read_notifications(&fixture, "charge.dispute.closed").await;
    assert_eq!(closed[0]["data"]["object"]["status"], "won");
}

async fn call_stripe(
    fixture: &NotificationFixture,
    api_path: &str,
    form_body: &str,
) -> (u16, Value) {
    let request = Request::builder()
        .method("POST")
        .uri(format!("/providers/stripe/v1{api_path}"))
        .header("authorization", "Bearer sk_test_sendmock")
        .header("content-type", "application/x-www-form-urlencoded")
        .body(Body::from(form_body.to_owned()))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    send_request(fixture.app_router.clone(), request).await
}

// AC: PY-07.3
#[tokio::test]
async fn stripes_dispute_api_submits_evidence_or_closes_the_dispute_as_lost() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), &["stripe"]).await;
    let answered_id = open_dispute(&fixture, "stripe").await;
    let accepted_id = open_dispute(&fixture, "stripe").await;
    let dispute_id_of = |payment: &Value| {
        payment["provider_ids"]["payment_intent"]
            .as_str()
            .unwrap_or_default()
            .replace("pi_", "dp_")
    };
    let answered_dispute_id = dispute_id_of(&fixture.read_payment(&answered_id).await);
    let accepted_dispute_id = dispute_id_of(&fixture.read_payment(&accepted_id).await);

    let (status, submitted) = call_stripe(
        &fixture,
        &format!("/disputes/{answered_dispute_id}"),
        "evidence[uncategorized_text]=Tracking+1Z999&submit=true",
    )
    .await;
    let (close_status, closed) = call_stripe(
        &fixture,
        &format!("/disputes/{accepted_dispute_id}/close"),
        "",
    )
    .await;
    let (closed_again_status, _) = call_stripe(
        &fixture,
        &format!("/disputes/{accepted_dispute_id}/close"),
        "",
    )
    .await;

    assert_eq!(status, 200, "{submitted}");
    assert_eq!(submitted["object"], "dispute");
    assert_eq!(submitted["status"], "under_review");
    assert_eq!(
        submitted["evidence"]["uncategorized_text"],
        "Tracking 1Z999"
    );
    assert_eq!(close_status, 200, "{closed}");
    assert_eq!(closed["status"], "lost");
    assert_eq!(closed_again_status, 400);
    let accepted_payment = fixture.read_payment(&accepted_id).await;
    assert_eq!(accepted_payment["status"], "refunded");
}

// AC: PY-07.3
#[tokio::test]
async fn paypal_sends_dispute_updated_and_resolved_for_an_answered_lost_dispute() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), &["paypal"]).await;
    let payment_id = open_dispute(&fixture, "paypal").await;

    simulate(
        &fixture,
        &payment_id,
        json!({ "action": "answer_dispute", "dispute_evidence": "Proof of delivery." }),
    )
    .await;
    let (lost_status, lost) = simulate(
        &fixture,
        &payment_id,
        json!({ "action": "resolve_dispute", "dispute_outcome": "lost" }),
    )
    .await;

    assert_eq!(lost_status, 200, "{lost}");
    assert_eq!(lost["status"], "refunded");
    let updated = read_notifications(&fixture, "CUSTOMER.DISPUTE.UPDATED").await;
    assert_eq!(updated.len(), 1, "{updated:?}");
    assert_eq!(updated[0]["resource"]["status"], "UNDER_REVIEW");
    let resolved = read_notifications(&fixture, "CUSTOMER.DISPUTE.RESOLVED").await;
    assert_eq!(
        resolved[0]["resource"]["dispute_outcome"]["outcome_code"],
        "RESOLVED_BUYER_FAVOUR"
    );
}
