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

/// Posts an open and answers the status.
async fn open_message(app_router: &axum::Router, open_path: &str, open_body: Value) -> u16 {
    let (status, answer) = call_api(app_router, "POST", open_path, Some(&open_body)).await;
    assert!(status == 204 || answer["error"].is_object(), "{answer}");
    status
}

async fn read_json(app_router: &axum::Router, path: &str) -> Value {
    let (status, answer) = call_api(app_router, "GET", path, None).await;
    assert_eq!(status, 200, "{answer}");
    answer
}

/// The event's data, oldest first.
async fn event_data_of(app_router: &axum::Router, event_type: &str) -> Vec<Value> {
    let recent = read_json(
        app_router,
        &format!("/api/v1/events/recent?type={event_type}"),
    )
    .await;
    let mut event_data: Vec<Value> = recent
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .map(|recent_event| recent_event["data"].clone())
        .collect();
    event_data.reverse();
    event_data
}

fn open_fields(event_data: &[Value]) -> Vec<(Value, Value, Value)> {
    event_data
        .iter()
        .map(|data| {
            (
                data["first_open"].clone(),
                data["open_count"].clone(),
                data["source"].clone(),
            )
        })
        .collect()
}

async fn send_sms(app_router: &axum::Router, sms_path: &str, sms_body: Value) -> String {
    let (status, sms) = call_api(app_router, "POST", sms_path, Some(&sms_body)).await;
    assert!(status == 200 || status == 201, "{status} {sms}");
    sms["id"].as_str().unwrap_or_default().to_owned()
}

async fn send_outbound_sms(app_router: &axum::Router) -> String {
    send_sms(
        app_router,
        "/api/v1/sms",
        json!({ "from": "+15550001111", "to": "+8801700000000", "body": "Your code is 482913" }),
    )
    .await
}

// AC: EM-11.1
#[tokio::test]
async fn a_view_fires_email_opened_once_with_first_open() {
    let (app_router, _) = build_test_app();
    let email_id = send_email(&app_router, "sam@example.test", "Welcome").await;
    let open_path = format!("/api/v1/emails/{email_id}/open");

    open_message(&app_router, &open_path, json!({ "source": "ui" })).await;
    let repeated_status = open_message(&app_router, &open_path, json!({ "source": "ui" })).await;

    assert_eq!(repeated_status, 204);
    let opened_events = event_data_of(&app_router, "email.opened").await;
    assert_eq!(
        open_fields(&opened_events),
        [(json!(true), json!(1), json!("ui"))]
    );
    assert_eq!(opened_events[0]["id"], json!(email_id));
    assert_eq!(opened_events[0]["subject"], "Welcome");
    assert_eq!(opened_events[0]["opened_at"], "2026-01-01T00:00:00Z");
    let email = read_json(&app_router, &format!("/api/v1/emails/{email_id}")).await;
    assert_eq!(email["open_count"], 1);
}

// AC: EM-11.2
#[tokio::test]
async fn with_every_open_a_view_fires_again_with_a_higher_count() {
    let (app_router, _) = build_test_app();
    use_settings(&app_router, json!({ "opened_event_mode": "every_open" })).await;
    let email_id = send_email(&app_router, "sam@example.test", "Welcome").await;
    let open_path = format!("/api/v1/emails/{email_id}/open");

    open_message(&app_router, &open_path, json!({ "source": "ui" })).await;
    open_message(&app_router, &open_path, json!({ "source": "ui" })).await;

    assert_eq!(
        open_fields(&event_data_of(&app_router, "email.opened").await),
        [
            (json!(true), json!(1), json!("ui")),
            (json!(false), json!(2), json!("ui")),
        ]
    );
}

// AC: EM-11.3
#[tokio::test]
async fn manual_and_api_opens_always_fire_and_are_kept_in_the_history() {
    let (app_router, _) = build_test_app();
    let email_id = send_email(&app_router, "sam@example.test", "Welcome").await;
    let open_path = format!("/api/v1/emails/{email_id}/open");

    open_message(&app_router, &open_path, json!({ "source": "ui" })).await;
    open_message(&app_router, &open_path, json!({ "source": "manual" })).await;
    open_message(
        &app_router,
        &open_path,
        json!({ "user_agent": " curl/8.7.1 " }),
    )
    .await;

    assert_eq!(
        open_fields(&event_data_of(&app_router, "email.opened").await),
        [
            (json!(true), json!(1), json!("ui")),
            (json!(false), json!(2), json!("manual")),
            (json!(false), json!(3), json!("api")),
        ]
    );
    let opens = read_json(&app_router, &format!("/api/v1/emails/{email_id}/opens")).await;
    assert_eq!(
        opens,
        json!([
            { "opened_at": "2026-01-01T00:00:00Z", "source": "ui", "user_agent": null },
            { "opened_at": "2026-01-01T00:00:00Z", "source": "manual", "user_agent": null },
            { "opened_at": "2026-01-01T00:00:00Z", "source": "api", "user_agent": "curl/8.7.1" },
        ])
    );
    let timeline = read_json(&app_router, &format!("/api/v1/emails/{email_id}/timeline")).await;
    let open_details: Vec<&Value> = timeline
        .as_array()
        .into_iter()
        .flatten()
        .filter(|timeline_entry| timeline_entry["kind"] == "opened")
        .map(|timeline_entry| &timeline_entry["detail"])
        .collect();
    assert_eq!(
        open_details,
        [
            "Opened in the SendMock UI",
            "Opened with Simulate open",
            "Opened through the API",
        ]
    );
}

// AC: EM-11.4
#[tokio::test]
async fn with_auto_fire_off_a_view_records_nothing_but_the_api_still_fires() {
    let (app_router, _) = build_test_app();
    use_settings(&app_router, json!({ "fire_opened_events_on_view": false })).await;
    let email_id = send_email(&app_router, "sam@example.test", "Welcome").await;
    let open_path = format!("/api/v1/emails/{email_id}/open");

    let view_status = open_message(&app_router, &open_path, json!({ "source": "ui" })).await;
    let opens_after_view =
        read_json(&app_router, &format!("/api/v1/emails/{email_id}/opens")).await;
    open_message(&app_router, &open_path, json!({ "source": "api" })).await;

    assert_eq!(view_status, 204);
    assert_eq!(opens_after_view, json!([]));
    assert_eq!(
        open_fields(&event_data_of(&app_router, "email.opened").await),
        [(json!(true), json!(1), json!("api"))]
    );
}

// AC: EM-11.5
#[tokio::test]
async fn mark_unread_keeps_the_open_count_and_first_open_time() {
    let (app_router, _) = build_test_app();
    let email_id = send_email(&app_router, "sam@example.test", "Welcome").await;
    let email_path = format!("/api/v1/emails/{email_id}");
    open_message(&app_router, &format!("{email_path}/open"), json!({})).await;
    call_api(
        &app_router,
        "PATCH",
        &email_path,
        Some(&json!({ "is_read": true })),
    )
    .await;

    let (status, email) = call_api(
        &app_router,
        "PATCH",
        &email_path,
        Some(&json!({ "is_read": false })),
    )
    .await;

    assert_eq!(status, 200, "{email}");
    assert_eq!(email["is_read"], false);
    assert_eq!(email["open_count"], 1);
    // The update answers the summary, which has no `opened_at`; the detail has it.
    let email_detail = read_json(&app_router, &email_path).await;
    assert_eq!(email_detail["open_count"], 1);
    assert_eq!(email_detail["opened_at"], "2026-01-01T00:00:00Z");
}

#[tokio::test]
async fn unknown_messages_and_long_user_agents_are_refused() {
    let (app_router, _) = build_test_app();
    let email_id = send_email(&app_router, "sam@example.test", "Welcome").await;

    let unknown_paths = [
        ("POST", "/api/v1/emails/01UNKNOWN/open"),
        ("GET", "/api/v1/emails/01UNKNOWN/opens"),
        ("POST", "/api/v1/sms/01UNKNOWN/open"),
        ("GET", "/api/v1/sms/01UNKNOWN/opens"),
    ];
    for (method, unknown_path) in unknown_paths {
        let (status, _) = call_api(&app_router, method, unknown_path, Some(&json!({}))).await;
        assert_eq!(status, 404, "{method} {unknown_path}");
    }
    let (status, answer) = call_api(
        &app_router,
        "POST",
        &format!("/api/v1/emails/{email_id}/open"),
        Some(&json!({ "user_agent": "a".repeat(513) })),
    )
    .await;
    assert_eq!(status, 400);
    assert_eq!(answer["error"]["field"], "user_agent");
}

// AC: SM-10.2
#[tokio::test]
async fn an_inbound_sms_cannot_be_opened() {
    let (app_router, _) = build_test_app();
    let inbound_sms_id = send_sms(
        &app_router,
        "/api/v1/sms/inbound",
        json!({ "from": "+8801700000000", "to": "+15550001111", "body": "STOP" }),
    )
    .await;

    let (status, answer) = call_api(
        &app_router,
        "POST",
        &format!("/api/v1/sms/{inbound_sms_id}/open"),
        Some(&json!({ "source": "api" })),
    )
    .await;

    assert_eq!(status, 409, "{answer}");
    assert_eq!(answer["error"]["code"], "inbound_sms");
    assert!(event_data_of(&app_router, "sms.opened").await.is_empty());
}

// AC: SM-10.3
#[tokio::test]
async fn manual_and_api_reads_of_an_outbound_sms_always_fire() {
    let (app_router, _) = build_test_app();
    let sms_id = send_outbound_sms(&app_router).await;
    let open_path = format!("/api/v1/sms/{sms_id}/open");

    open_message(&app_router, &open_path, json!({ "source": "manual" })).await;
    open_message(&app_router, &open_path, json!({})).await;
    open_message(&app_router, &open_path, json!({ "source": "ui" })).await;

    let opened_events = event_data_of(&app_router, "sms.opened").await;
    assert_eq!(
        open_fields(&opened_events),
        [
            (json!(true), json!(1), json!("manual")),
            (json!(false), json!(2), json!("api")),
        ]
    );
    assert_eq!(opened_events[0]["id"], json!(sms_id));
    assert_eq!(opened_events[0]["body"], "Your code is 482913");
    let opens = read_json(&app_router, &format!("/api/v1/sms/{sms_id}/opens")).await;
    assert_eq!(opens.as_array().map(Vec::len), Some(2));
    let sms = read_json(&app_router, &format!("/api/v1/sms/{sms_id}")).await;
    assert_eq!(sms["open_count"], 2);
    assert_eq!(sms["opened_at"], "2026-01-01T00:00:00Z");
}

#[tokio::test]
async fn a_rule_filters_opened_events_on_the_open_source() {
    let (app_router, operation_context) =
        build_test_app_with(|operation_context| operation_context);
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(operation_context.clone()));
    tokio::task::yield_now().await;
    let endpoint_id = create_endpoint(&app_router, "Open tracking").await;
    create_rule(
        &app_router,
        &json!({
            "name": "Simulated opens", "endpoint_id": endpoint_id,
            "events": ["email.opened"], "is_enabled": true,
            "filter": { "field": "source", "operator": "equals", "value": "manual" },
        }),
    )
    .await;
    let email_id = send_email(&app_router, "sam@example.test", "Welcome").await;
    let open_path = format!("/api/v1/emails/{email_id}/open");

    open_message(&app_router, &open_path, json!({ "source": "api" })).await;
    open_message(&app_router, &open_path, json!({ "source": "manual" })).await;
    tokio::time::sleep(Duration::from_millis(200)).await;
    subscriber.abort();

    let deliveries = read_json(&app_router, "/api/v1/webhooks/deliveries").await;
    let delivered_events: Vec<&Value> = deliveries["items"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|delivery| &delivery["event_type"])
        .collect();
    assert_eq!(delivered_events, ["email.opened"]);
}

/// An endpoint that sends Twilio's status callback for the events its rule names.
async fn create_twilio_status_endpoint(app_router: &axum::Router) -> String {
    let endpoint_id = create_endpoint(app_router, "Twilio read receipts").await;
    let (status, updated) = call_api(
        app_router,
        "PATCH",
        &format!("/api/v1/webhooks/endpoints/{endpoint_id}"),
        Some(&json!({
            "template_id": "twilio.status_callback", "template_mode": "linked",
            "body_mode": "template",
        })),
    )
    .await;
    assert_eq!(status, 200, "{updated}");
    endpoint_id
}

// AC: SM-10.3 SM-11.3
#[tokio::test]
async fn an_opened_sms_sends_twilios_read_status() {
    let (app_router, operation_context) =
        build_test_app_with(|operation_context| operation_context);
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(operation_context.clone()));
    tokio::task::yield_now().await;
    let endpoint_id = create_twilio_status_endpoint(&app_router).await;
    create_rule(
        &app_router,
        &json!({
            "name": "Read receipts", "endpoint_id": endpoint_id,
            "events": ["sms.opened"], "is_enabled": true,
        }),
    )
    .await;
    let sms_id = send_outbound_sms(&app_router).await;

    open_message(
        &app_router,
        &format!("/api/v1/sms/{sms_id}/open"),
        json!({ "source": "api" }),
    )
    .await;
    tokio::time::sleep(Duration::from_millis(200)).await;
    subscriber.abort();

    let deliveries = read_json(&app_router, "/api/v1/webhooks/deliveries").await;
    let read_receipt = deliveries["items"]
        .as_array()
        .into_iter()
        .flatten()
        .find(|delivery| delivery["event_type"] == "sms.opened")
        .cloned()
        .unwrap_or(Value::Null);
    let callback_body = read_receipt["request"]["body"].as_str().unwrap_or_default();
    assert!(
        callback_body.contains("MessageStatus=read"),
        "{read_receipt}"
    );
    assert!(callback_body.contains("SmsStatus=read"), "{read_receipt}");
}
