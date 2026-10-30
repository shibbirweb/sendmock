#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use std::time::Duration;

use sendmock_ops::run_webhook_rule_subscriber;
use serde_json::{Value, json};
use support::test_app::{build_test_app, build_test_app_with, call_api};
use support::webhook_samples::{create_endpoint, create_rule, send_email};

async fn use_settings(app_router: &axum::Router, settings_change: Value) {
    let (status, answer) = call_api(
        app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&settings_change),
    )
    .await;
    assert_eq!(status, 200, "{answer}");
}

async fn read_delivery_status(app_router: &axum::Router, email_id: &str) -> Value {
    let (_, email) = call_api(
        app_router,
        "GET",
        &format!("/api/v1/emails/{email_id}"),
        None,
    )
    .await;
    email["delivery_status"].clone()
}

async fn read_timeline(app_router: &axum::Router, email_id: &str) -> Vec<Value> {
    let timeline_path = format!("/api/v1/emails/{email_id}/timeline");
    let (_, timeline) = call_api(app_router, "GET", &timeline_path, None).await;
    timeline.as_array().cloned().unwrap_or_default()
}

/// The timeline's kinds after `received`, in order.
async fn reported_kinds(app_router: &axum::Router, email_id: &str) -> Vec<String> {
    read_timeline(app_router, email_id)
        .await
        .iter()
        .filter_map(|timeline_entry| timeline_entry["kind"].as_str())
        .filter(|kind| *kind != "received")
        .map(str::to_owned)
        .collect()
}

async fn recent_events(app_router: &axum::Router, event_type: &str) -> Vec<Value> {
    let events_path = format!("/api/v1/events/recent?type={event_type}");
    let (_, recent) = call_api(app_router, "GET", &events_path, None).await;
    recent.as_array().cloned().unwrap_or_default()
}

/// Waits up to five seconds, longer than an outcome's follow-up delay.
async fn wait_for_status(app_router: &axum::Router, email_id: &str, expected_status: &str) {
    for _ in 0..100 {
        if read_delivery_status(app_router, email_id).await == expected_status {
            return;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    panic!("{email_id} never became {expected_status}");
}

// AC: EM-10.1
#[tokio::test]
async fn magic_addresses_report_their_outcome_before_the_send_answers() {
    let (app_router, _) = build_test_app();
    let expected_outcomes = [
        ("delivered@shop.test", "delivered"),
        ("success@simulator.amazonses.com", "delivered"),
        ("bounce@shop.test", "bounced"),
        ("bounce+hard@shop.test", "bounced"),
        ("bounce@simulator.amazonses.com", "bounced"),
        ("suppressionlist@simulator.amazonses.com", "bounced"),
        ("bounce+soft@shop.test", "deferred"),
        ("complaint@simulator.amazonses.com", "delivered"),
    ];

    for (recipient, expected_status) in expected_outcomes {
        let email_id = send_email(&app_router, recipient, "Outcome").await;

        assert_eq!(
            read_delivery_status(&app_router, &email_id).await,
            expected_status,
            "{recipient}"
        );
    }
}

// AC: EM-10.1
// AC: EM-10.4
#[tokio::test]
async fn a_hard_bounce_is_on_the_timeline_and_its_event_carries_the_code_and_reason() {
    let (app_router, _) = build_test_app();

    let email_id = send_email(&app_router, "bounce@shop.test", "Welcome").await;

    let timeline = read_timeline(&app_router, &email_id).await;
    let bounce_entry = timeline.iter().find(|entry| entry["kind"] == "bounced");
    assert_eq!(
        bounce_entry.map(|entry| entry["detail"].clone()),
        Some(json!(
            "bounce@shop.test: hard bounce, 550 5.1.1 user unknown (magic address)"
        ))
    );
    let bounce_events = recent_events(&app_router, "email.bounced").await;
    let bounce_data = &bounce_events[0]["data"];
    assert_eq!(bounce_data["id"], json!(email_id));
    assert_eq!(bounce_data["recipient"], "bounce@shop.test");
    assert_eq!(bounce_data["bounce_type"], "hard");
    assert_eq!(bounce_data["smtp_code"], "550 5.1.1");
    assert_eq!(bounce_data["diagnostic"], "user unknown");
    assert_eq!(bounce_data["delivery_status"], "bounced");
}

// AC: EM-10.1
#[tokio::test]
async fn bounce_plus_soft_is_deferred_then_soft_bounced() {
    let (app_router, _) = build_test_app();

    let email_id = send_email(&app_router, "bounce+soft@shop.test", "Welcome").await;
    wait_for_status(&app_router, &email_id, "bounced").await;

    assert_eq!(
        reported_kinds(&app_router, &email_id).await,
        vec!["deferred", "bounced"]
    );
    let bounce_events = recent_events(&app_router, "email.bounced").await;
    assert_eq!(bounce_events[0]["data"]["bounce_type"], "soft");
    assert_eq!(recent_events(&app_router, "email.deferred").await.len(), 1);
}

// AC: EM-10.1
#[tokio::test]
async fn a_complaint_address_is_delivered_then_complained() {
    let (app_router, _) = build_test_app();

    let email_id = send_email(&app_router, "complaint@shop.test", "Newsletter").await;
    wait_for_status(&app_router, &email_id, "complained").await;

    assert_eq!(
        reported_kinds(&app_router, &email_id).await,
        vec!["delivered", "complained"]
    );
    assert_eq!(
        recent_events(&app_router, "email.complained").await.len(),
        1
    );
}

/// Waits up to five seconds for the out-of-office reply to arrive.
async fn wait_for_inbound_email(app_router: &axum::Router) -> Value {
    for _ in 0..100 {
        let (_, page) = call_api(app_router, "GET", "/api/v1/emails?direction=inbound", None).await;
        if let Some(inbound_email) = page["items"].get(0) {
            return inbound_email.clone();
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    panic!("no out-of-office reply arrived");
}

// AC: EM-10.1
#[tokio::test]
async fn the_ses_out_of_office_address_is_delivered_then_replies() {
    let (app_router, _) = build_test_app();

    let email_id = send_email(&app_router, "ooto@simulator.amazonses.com", "Invoice").await;
    let reply = wait_for_inbound_email(&app_router).await;

    assert_eq!(
        read_delivery_status(&app_router, &email_id).await,
        "delivered"
    );
    assert_eq!(reply["subject"], "Out of office: Invoice");
    assert_eq!(reply["from"]["address"], "ooto@simulator.amazonses.com");
    assert_eq!(reply["direction"], "inbound");
    assert_eq!(
        reported_kinds(&app_router, &email_id).await,
        vec!["delivered", "replied"]
    );
    assert_eq!(recent_events(&app_router, "email.inbound").await.len(), 1);
}

// AC: EM-10.2
#[tokio::test]
async fn the_off_profile_reports_nothing_for_ordinary_addresses() {
    let (app_router, _) = build_test_app();
    use_settings(&app_router, json!({ "email_outcome_profile": "off" })).await;

    let email_id = send_email(&app_router, "sam@shop.test", "Welcome").await;
    tokio::time::sleep(Duration::from_millis(1_500)).await;

    assert_eq!(
        read_delivery_status(&app_router, &email_id).await,
        Value::Null
    );
    assert!(reported_kinds(&app_router, &email_id).await.is_empty());
}

// AC: EM-10.2
#[tokio::test]
async fn auto_delivered_marks_every_email_delivered_after_a_short_delay() {
    let (app_router, _) = build_test_app();
    use_settings(
        &app_router,
        json!({ "email_outcome_profile": "auto-delivered" }),
    )
    .await;

    let email_id = send_email(&app_router, "sam@shop.test", "Welcome").await;
    let status_on_answer = read_delivery_status(&app_router, &email_id).await;
    wait_for_status(&app_router, &email_id, "delivered").await;

    assert_eq!(status_on_answer, Value::Null);
    let timeline = read_timeline(&app_router, &email_id).await;
    assert!(
        timeline
            .iter()
            .any(|entry| entry["detail"] == "sam@shop.test: delivered (delivery profile)"),
        "{timeline:?}"
    );
}

// AC: EM-10.2
#[tokio::test]
async fn realistic_bounces_and_complains_at_the_configured_rates() {
    let (app_router, _) = build_test_app();
    let realistic = |bounce_rate: u32, complaint_rate: u32| {
        json!({
            "email_outcome_profile": "realistic",
            "email_outcome_bounce_rate_percent": bounce_rate,
            "email_outcome_complaint_rate_percent": complaint_rate,
        })
    };

    use_settings(&app_router, realistic(100, 0)).await;
    let bounced_id = send_email(&app_router, "sam@shop.test", "One").await;
    use_settings(&app_router, realistic(0, 100)).await;
    let complained_id = send_email(&app_router, "ann@shop.test", "Two").await;

    wait_for_status(&app_router, &bounced_id, "bounced").await;
    wait_for_status(&app_router, &complained_id, "complained").await;
}

// AC: EM-10.6
#[tokio::test]
async fn with_magic_addresses_off_a_magic_address_is_an_ordinary_one() {
    let (app_router, _) = build_test_app();
    use_settings(&app_router, json!({ "is_magic_addresses_enabled": false })).await;

    let email_id = send_email(&app_router, "bounce@shop.test", "Welcome").await;

    assert_eq!(
        read_delivery_status(&app_router, &email_id).await,
        Value::Null
    );
    assert!(recent_events(&app_router, "email.bounced").await.is_empty());
}

async fn simulate(app_router: &axum::Router, email_id: &str, simulated_outcome: Value) -> u16 {
    let simulate_path = format!("/api/v1/emails/{email_id}/simulate");
    let (status, _) = call_api(app_router, "POST", &simulate_path, Some(&simulated_outcome)).await;
    status
}

// AC: EM-10.3
#[tokio::test]
async fn simulate_fires_the_chosen_event_on_any_email() {
    let (app_router, _) = build_test_app();
    let email_id = send_email(&app_router, "sam@shop.test", "Welcome").await;

    let bounce_status = simulate(
        &app_router,
        &email_id,
        json!({ "event": "bounced", "bounce_type": "soft" }),
    )
    .await;
    let after_bounce = read_delivery_status(&app_router, &email_id).await;
    let unsubscribe_status =
        simulate(&app_router, &email_id, json!({ "event": "unsubscribed" })).await;

    assert_eq!((bounce_status, unsubscribe_status), (204, 204));
    assert_eq!(after_bounce, "bounced");
    assert_eq!(
        read_delivery_status(&app_router, &email_id).await,
        "unsubscribed"
    );
    let timeline = read_timeline(&app_router, &email_id).await;
    assert!(timeline.iter().any(|entry| {
        entry["detail"] == "sam@shop.test: soft bounce, 452 4.2.2 mailbox full (simulated)"
    }));
    assert_eq!(
        recent_events(&app_router, "email.bounced").await[0]["data"]["bounce_type"],
        "soft"
    );
    assert_eq!(
        recent_events(&app_router, "email.unsubscribed").await.len(),
        1
    );
}

// AC: EM-10.3
#[tokio::test]
async fn simulate_refuses_an_unknown_email_or_event() {
    let (app_router, _) = build_test_app();
    let email_id = send_email(&app_router, "sam@shop.test", "Welcome").await;

    let unknown_email = simulate(
        &app_router,
        "01JUNKNOWNEMAIL00000000000",
        json!({ "event": "delivered" }),
    )
    .await;
    let unknown_event = simulate(&app_router, &email_id, json!({ "event": "exploded" })).await;

    assert_eq!(unknown_email, 404);
    assert_eq!(unknown_event, 400);
}

// AC: EM-10.4
#[tokio::test]
async fn a_webhook_rule_on_email_bounced_receives_only_the_bounce() {
    let (app_router, operation_context) =
        build_test_app_with(|operation_context| operation_context);
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(operation_context.clone()));
    tokio::task::yield_now().await;
    let endpoint_id = create_endpoint(&app_router, "Bounce handler").await;
    create_rule(
        &app_router,
        &json!({
            "name": "Bounces", "endpoint_id": endpoint_id, "events": ["email.bounced"],
            "filter": { "all": [] }, "is_enabled": true,
        }),
    )
    .await;

    send_email(&app_router, "sam@shop.test", "Ordinary").await;
    let bounced_id = send_email(&app_router, "bounce@shop.test", "Bounced").await;
    let mut deliveries = Vec::new();
    for _ in 0..200 {
        let (_, page) = call_api(&app_router, "GET", "/api/v1/webhooks/deliveries", None).await;
        deliveries = page["items"].as_array().cloned().unwrap_or_default();
        if !deliveries.is_empty() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    subscriber.abort();

    assert_eq!(deliveries.len(), 1);
    assert_eq!(deliveries[0]["event_type"], "email.bounced");
    assert_eq!(deliveries[0]["subject_id"], json!(bounced_id));
}
