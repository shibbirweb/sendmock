#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod fake_email_relay;
    pub mod test_app;
}

use std::sync::Arc;
use std::time::Duration;

use sendmock_ops::RecentEventFilter;
use serde_json::{Value, json};
use support::fake_email_relay::FakeRelay;
use support::test_app::{build_test_app, build_test_app_with, call_api};

const TAG_RULES_PATH: &str = "/api/v1/tag-rules";
const FORWARD_RULES_PATH: &str = "/api/v1/forward-rules";

fn subject_filter(subject_part: &str) -> Value {
    json!({ "field": "subject", "operator": "contains", "value": subject_part })
}

async fn create_rule(app_router: &axum::Router, rules_path: &str, rule_input: Value) -> Value {
    let (status, created) = call_api(app_router, "POST", rules_path, Some(&rule_input)).await;
    assert_eq!(status, 201, "{created}");
    created
}

async fn send_email(app_router: &axum::Router, recipient: &str, subject: &str) -> Value {
    let (status, sent) = call_api(
        app_router,
        "POST",
        "/api/v1/send",
        Some(&json!({
            "from": "app@shop.test", "to": [recipient], "subject": subject, "text": "Hello",
        })),
    )
    .await;
    assert_eq!(status, 201, "{sent}");
    let email_id = sent["id"].as_str().unwrap_or_default();
    call_api(
        app_router,
        "GET",
        &format!("/api/v1/emails/{email_id}"),
        None,
    )
    .await
    .1
}

// AC: EM-12.3
#[tokio::test]
async fn tag_rules_add_their_tag_to_matching_new_emails_once_and_skip_switched_off_rules() {
    let (app_router, operation_context) = build_test_app();
    for (rule_name, tag, is_enabled) in [
        ("Billing", "billing", true),
        ("Billing again", "billing", true),
        ("Off", "ignored", false),
    ] {
        create_rule(
            &app_router,
            TAG_RULES_PATH,
            json!({ "name": rule_name, "filter": subject_filter("Invoice"), "tag": tag, "is_enabled": is_enabled }),
        )
        .await;
    }
    create_rule(
        &app_router,
        TAG_RULES_PATH,
        json!({ "name": "Everything", "filter": null, "tag": "All-Mail", "is_enabled": true }),
    )
    .await;

    let invoice_email = send_email(&app_router, "sam@example.test", "Invoice 7").await;
    let welcome_email = send_email(&app_router, "sam@example.test", "Welcome").await;

    assert_eq!(invoice_email["tags"], json!(["billing", "all-mail"]));
    assert_eq!(welcome_email["tags"], json!(["all-mail"]));
    let received_events = operation_context
        .event_bus
        .recent_events(&RecentEventFilter {
            created_after_unix_ms: None,
            event_type: Some("email.received".to_owned()),
            limit: 10,
            ..RecentEventFilter::default()
        });
    let invoice_event = received_events
        .iter()
        .find(|recorded_event| recorded_event.app_event.data["id"] == invoice_email["id"]);
    assert_eq!(
        invoice_event.map(|recorded_event| recorded_event.app_event.data["tags"].clone()),
        Some(json!(["billing", "all-mail"]))
    );
}

#[tokio::test]
async fn new_rules_need_a_name_their_tag_or_addresses_and_a_complete_filter() {
    let (app_router, _) = build_test_app();
    let refused_inputs = [
        (
            TAG_RULES_PATH,
            json!({ "name": " ", "filter": null, "tag": "x", "is_enabled": true }),
        ),
        (
            TAG_RULES_PATH,
            json!({ "name": "A", "filter": null, "tag": " ", "is_enabled": true }),
        ),
        (
            FORWARD_RULES_PATH,
            json!({ "name": "A", "filter": null, "to": [], "is_enabled": true }),
        ),
        (
            TAG_RULES_PATH,
            json!({ "name": "A", "filter": subject_filter(""), "tag": "x", "is_enabled": true }),
        ),
    ];

    let mut statuses = Vec::new();
    for (rules_path, rule_input) in refused_inputs {
        statuses.push(
            call_api(&app_router, "POST", rules_path, Some(&rule_input))
                .await
                .0,
        );
    }
    let created = create_rule(
        &app_router,
        FORWARD_RULES_PATH,
        json!({ "name": "Team", "filter": null, "to": [" qa@example.test ", ""], "is_enabled": true }),
    )
    .await;

    assert_eq!(statuses, [400, 400, 400, 400]);
    assert_eq!(created["to"], json!(["qa@example.test"]));
}

#[tokio::test]
async fn a_rule_changes_only_the_keys_sent_and_is_deleted_once() {
    let (app_router, _) = build_test_app();
    let tag_rule = create_rule(
        &app_router,
        TAG_RULES_PATH,
        json!({ "name": "First", "filter": null, "tag": "one", "is_enabled": true }),
    )
    .await;
    let tag_rule_path = format!(
        "{TAG_RULES_PATH}/{}",
        tag_rule["id"].as_str().unwrap_or_default()
    );

    let (_, renamed) = call_api(
        &app_router,
        "PATCH",
        &tag_rule_path,
        Some(&json!({ "name": "Renamed", "is_enabled": false })),
    )
    .await;
    let (delete_status, _) = call_api(&app_router, "DELETE", &tag_rule_path, None).await;
    let (again_status, _) = call_api(&app_router, "DELETE", &tag_rule_path, None).await;

    assert_eq!(renamed["name"], "Renamed");
    assert_eq!(renamed["is_enabled"], false);
    assert_eq!(renamed["tag"], "one");
    assert_eq!(delete_status, 204);
    assert_eq!(again_status, 404);
}

#[tokio::test]
async fn moving_a_tag_rule_down_swaps_it_with_the_next_one() {
    let (app_router, _) = build_test_app();
    let first = create_rule(
        &app_router,
        TAG_RULES_PATH,
        json!({ "name": "First", "filter": null, "tag": "one", "is_enabled": true }),
    )
    .await;
    create_rule(
        &app_router,
        TAG_RULES_PATH,
        json!({ "name": "Second", "filter": null, "tag": "two", "is_enabled": true }),
    )
    .await;

    let (status, reordered) = call_api(
        &app_router,
        "POST",
        &format!(
            "{TAG_RULES_PATH}/{}/move",
            first["id"].as_str().unwrap_or_default()
        ),
        Some(&json!({ "direction": "down" })),
    )
    .await;

    assert_eq!(status, 200, "{reordered}");
    assert_eq!(reordered[0]["name"], "Second");
    assert_eq!(reordered[1]["name"], "First");
    assert_eq!(reordered[1]["position"], 2);
}

fn build_app_with_relay() -> (axum::Router, sendmock_ops::OperationContext, Arc<FakeRelay>) {
    let fake_relay = Arc::new(FakeRelay::default());
    let (app_router, operation_context) = build_test_app_with(|operation_context| {
        operation_context.with_email_relay(fake_relay.clone())
    });
    (app_router, operation_context, fake_relay)
}

/// Forward rules run in the background, so the test looks until the timeline has `count`
/// release entries or two seconds pass.
async fn wait_for_released_details(
    app_router: &axum::Router,
    email_id: &str,
    count: usize,
) -> Vec<String> {
    let mut released_details = Vec::new();
    for _ in 0..40 {
        let (_, timeline) = call_api(
            app_router,
            "GET",
            &format!("/api/v1/emails/{email_id}/timeline"),
            None,
        )
        .await;
        released_details = timeline
            .as_array()
            .into_iter()
            .flatten()
            .filter(|timeline_entry| timeline_entry["kind"] == "released")
            .filter_map(|timeline_entry| timeline_entry["detail"].as_str().map(str::to_owned))
            .collect();
        if released_details.len() >= count {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    released_details
}

// AC: EM-14.3 EM-14.4
#[tokio::test]
async fn forward_rules_release_matching_emails_to_their_allowlisted_addresses() {
    let (app_router, operation_context, fake_relay) = build_app_with_relay();
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({
            "relay_smtp_url": "smtp://relay.example.test:25",
            "relay_recipient_allowlist": ["*@qa.example.test"],
        })),
    )
    .await;
    create_rule(
        &app_router,
        FORWARD_RULES_PATH,
        json!({
            "name": "Receipts to QA", "filter": subject_filter("Receipt"),
            "to": ["team@qa.example.test", "boss@example.test"], "is_enabled": true,
        }),
    )
    .await;

    let receipt = send_email(&app_router, "sam@example.test", "Receipt 12").await;
    send_email(&app_router, "sam@example.test", "Welcome").await;
    let receipt_id = receipt["id"].as_str().unwrap_or_default();
    let released_details = wait_for_released_details(&app_router, receipt_id, 1).await;

    let relayed_messages = fake_relay.read_relayed_messages();
    assert_eq!(relayed_messages.len(), 1);
    assert_eq!(relayed_messages[0].recipients, ["team@qa.example.test"]);
    assert_eq!(released_details.len(), 1, "{released_details:?}");
    assert!(released_details[0].contains("by rule Receipts to QA"));
    let released_events = operation_context
        .event_bus
        .recent_events(&RecentEventFilter {
            created_after_unix_ms: None,
            event_type: Some("email.released".to_owned()),
            limit: 10,
            ..RecentEventFilter::default()
        });
    assert_eq!(released_events.len(), 1);
    assert_eq!(released_events[0].app_event.data["id"], receipt["id"]);
}

// AC: EM-14.1
#[tokio::test]
async fn without_a_relay_a_forward_rule_sends_nothing_and_says_why() {
    let (app_router, _, fake_relay) = build_app_with_relay();
    create_rule(
        &app_router,
        FORWARD_RULES_PATH,
        json!({ "name": "Everything", "filter": null, "to": ["qa@qa.example.test"], "is_enabled": true }),
    )
    .await;

    let email = send_email(&app_router, "sam@example.test", "Hello").await;
    let released_details =
        wait_for_released_details(&app_router, email["id"].as_str().unwrap_or_default(), 1).await;

    assert!(fake_relay.read_relayed_messages().is_empty());
    assert_eq!(
        released_details,
        ["Not forwarded by rule Everything: no relay, or no address on the allowlist"]
    );
}
