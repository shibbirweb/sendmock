#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use std::collections::BTreeSet;
use std::time::Duration;

use sendmock_ops::run_webhook_rule_subscriber;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use support::webhook_samples::{create_endpoint, create_rule, endpoint_input, send_email};

const MATCH_PATH: &str = "/api/v1/webhooks/rules/match";

/// Three endpoints: Receipts and Invoices each have a bounce rule with a subject filter,
/// Audit has none.
struct WebhookTargets {
    receipts_endpoint_id: String,
    invoices_endpoint_id: String,
    audit_endpoint_id: String,
    receipts_rule_id: String,
}

async fn create_bounce_rule(
    app_router: &axum::Router,
    rule_name: &str,
    endpoint_id: &str,
    subject_word: &str,
    is_enabled: bool,
) -> String {
    let created_rule = create_rule(app_router, &json!({
        "name": rule_name, "endpoint_id": endpoint_id, "events": ["email.bounced"],
        "filter": { "all": [{ "field": "subject", "operator": "contains", "value": subject_word }] },
        "is_enabled": is_enabled,
    }))
    .await;
    created_rule["id"].as_str().unwrap_or_default().to_owned()
}

async fn create_webhook_targets(app_router: &axum::Router) -> WebhookTargets {
    let receipts_endpoint_id = create_endpoint(app_router, "Receipts").await;
    let invoices_endpoint_id = create_endpoint(app_router, "Invoices").await;
    let audit_endpoint_id = create_endpoint(app_router, "Audit").await;
    let receipts_rule_id = create_bounce_rule(
        app_router,
        "Receipt bounces",
        &receipts_endpoint_id,
        "receipt",
        true,
    )
    .await;
    create_bounce_rule(
        app_router,
        "Invoice bounces",
        &invoices_endpoint_id,
        "invoice",
        true,
    )
    .await;
    create_bounce_rule(
        app_router,
        "Paused",
        &invoices_endpoint_id,
        "receipt",
        false,
    )
    .await;
    create_rule(app_router, &json!({
        "name": "Deliveries", "endpoint_id": invoices_endpoint_id, "events": ["email.delivered"],
        "is_enabled": true,
    }))
    .await;
    WebhookTargets {
        receipts_endpoint_id,
        invoices_endpoint_id,
        audit_endpoint_id,
        receipts_rule_id,
    }
}

async fn simulate_bounce(
    app_router: &axum::Router,
    email_id: &str,
    webhook_endpoint_ids: Option<Vec<&str>>,
) -> (u16, Value) {
    let mut simulate_input = json!({ "event": "bounced" });
    if let Some(webhook_endpoint_ids) = webhook_endpoint_ids {
        simulate_input["webhook_endpoint_ids"] = json!(webhook_endpoint_ids);
    }
    call_api(
        app_router,
        "POST",
        &format!("/api/v1/emails/{email_id}/simulate"),
        Some(&simulate_input),
    )
    .await
}

async fn list_email_deliveries(app_router: &axum::Router, email_id: &str) -> Vec<Value> {
    let (_, page) = call_api(
        app_router,
        "GET",
        &format!("/api/v1/webhooks/deliveries?subject_id={email_id}"),
        None,
    )
    .await;
    page["items"].as_array().cloned().unwrap_or_default()
}

/// Waits up to two seconds for `delivery_count` deliveries of the email.
async fn wait_for_deliveries(
    app_router: &axum::Router,
    email_id: &str,
    delivery_count: usize,
) -> Vec<Value> {
    let mut deliveries = Vec::new();
    for _ in 0..200 {
        deliveries = list_email_deliveries(app_router, email_id).await;
        if deliveries.len() >= delivery_count {
            break;
        }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    deliveries
}

fn read_field_set(items: &[Value], field_key: &str) -> BTreeSet<String> {
    items
        .iter()
        .filter_map(|item| item[field_key].as_str().map(str::to_owned))
        .collect()
}

// AC: WH-13.1
#[tokio::test]
async fn the_match_names_the_enabled_rules_whose_filter_the_stored_email_passes() {
    let (app_router, _) = build_test_app();
    let webhook_targets = create_webhook_targets(&app_router).await;
    let email_id = send_email(&app_router, "sam@example.test", "Your receipt").await;

    let (status, matched) = call_api(
        &app_router,
        "POST",
        MATCH_PATH,
        Some(&json!({ "event_type": "email.bounced", "subject_id": email_id })),
    )
    .await;

    assert_eq!(status, 200, "{matched}");
    assert_eq!(
        matched["webhook_rules"],
        json!([{
            "rule_id": webhook_targets.receipts_rule_id,
            "rule_name": "Receipt bounces",
            "endpoint_id": webhook_targets.receipts_endpoint_id,
            "endpoint_name": "Receipts",
            "endpoint_url": "http://localhost:3000/hooks",
        }])
    );
}

// AC: WH-13.1
#[tokio::test]
async fn data_fields_stand_in_for_a_message_that_is_not_stored_yet() {
    let (app_router, _) = build_test_app();
    let webhook_targets = create_webhook_targets(&app_router).await;

    let (status, matched) = call_api(
        &app_router,
        "POST",
        MATCH_PATH,
        Some(&json!({
            "event_type": "email.bounced",
            "data": { "subject": ["Your invoice"] },
        })),
    )
    .await;

    assert_eq!(status, 200, "{matched}");
    assert_eq!(
        read_field_set(
            matched["webhook_rules"]
                .as_array()
                .map_or(&[], Vec::as_slice),
            "endpoint_id"
        ),
        BTreeSet::from([webhook_targets.invoices_endpoint_id])
    );
}

// AC: WH-13.1
#[tokio::test]
async fn an_event_rules_cannot_listen_to_is_refused() {
    let (app_router, _) = build_test_app();

    let (status, refused) = call_api(
        &app_router,
        "POST",
        MATCH_PATH,
        Some(&json!({ "event_type": "email.exploded" })),
    )
    .await;

    assert_eq!(status, 400, "{refused}");
    assert_eq!(refused["error"]["field"], "event_type", "{refused}");
}

// AC: WH-13.1
#[tokio::test]
async fn a_simulation_then_reaches_exactly_what_the_match_named_and_the_match_sent_nothing() {
    let (app_router, operation_context) = build_test_app();
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(operation_context.clone()));
    tokio::task::yield_now().await;
    create_webhook_targets(&app_router).await;
    let email_id = send_email(&app_router, "sam@example.test", "Your receipt").await;
    let (_, matched) = call_api(
        &app_router,
        "POST",
        MATCH_PATH,
        Some(&json!({ "event_type": "email.bounced", "subject_id": email_id })),
    )
    .await;
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert!(
        list_email_deliveries(&app_router, &email_id)
            .await
            .is_empty()
    );
    let matched_rules = matched["webhook_rules"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    let (status, simulated) = simulate_bounce(&app_router, &email_id, None).await;
    let deliveries = wait_for_deliveries(&app_router, &email_id, matched_rules.len()).await;
    subscriber.abort();

    assert_eq!(status, 204, "{simulated}");
    assert_eq!(matched_rules.len(), 1, "{matched}");
    assert_eq!(
        read_field_set(&deliveries, "endpoint_id"),
        read_field_set(&matched_rules, "endpoint_id"),
        "{deliveries:?}"
    );
    assert_eq!(
        read_field_set(&deliveries, "trigger"),
        BTreeSet::from(["auto".to_owned()])
    );
}

// AC: WH-13.4 WH-13.5
#[tokio::test]
async fn a_chosen_simulation_delivers_to_exactly_the_chosen_endpoints() {
    let (app_router, operation_context) = build_test_app();
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(operation_context.clone()));
    tokio::task::yield_now().await;
    let webhook_targets = create_webhook_targets(&app_router).await;
    let email_id = send_email(&app_router, "sam@example.test", "Your receipt").await;

    let (status, simulated) = simulate_bounce(
        &app_router,
        &email_id,
        Some(vec![
            &webhook_targets.invoices_endpoint_id,
            &webhook_targets.audit_endpoint_id,
        ]),
    )
    .await;
    let deliveries = wait_for_deliveries(&app_router, &email_id, 2).await;
    tokio::time::sleep(Duration::from_millis(100)).await;
    let settled_deliveries = list_email_deliveries(&app_router, &email_id).await;
    subscriber.abort();

    assert_eq!(status, 204, "{simulated}");
    assert_eq!(settled_deliveries.len(), 2, "{settled_deliveries:?}");
    assert_eq!(
        read_field_set(&deliveries, "endpoint_id"),
        BTreeSet::from([
            webhook_targets.invoices_endpoint_id,
            webhook_targets.audit_endpoint_id,
        ])
    );
    assert_eq!(
        read_field_set(&deliveries, "trigger"),
        BTreeSet::from(["chosen".to_owned()])
    );
    let (_, rules) = call_api(&app_router, "GET", "/api/v1/webhooks/rules", None).await;
    assert_eq!(rules.as_array().map(Vec::len), Some(4), "{rules}");
}

// AC: WH-13.4 WH-13.5
#[tokio::test]
async fn an_empty_choice_sends_no_webhook() {
    let (app_router, operation_context) = build_test_app();
    let subscriber = tokio::spawn(run_webhook_rule_subscriber(operation_context.clone()));
    tokio::task::yield_now().await;
    create_webhook_targets(&app_router).await;
    let email_id = send_email(&app_router, "sam@example.test", "Your receipt").await;

    let (status, simulated) = simulate_bounce(&app_router, &email_id, Some(Vec::new())).await;
    tokio::time::sleep(Duration::from_millis(200)).await;
    let deliveries = list_email_deliveries(&app_router, &email_id).await;
    subscriber.abort();

    assert_eq!(status, 204, "{simulated}");
    assert!(deliveries.is_empty(), "{deliveries:?}");
}

// AC: WH-13.5
#[tokio::test]
async fn an_unknown_or_disabled_endpoint_is_refused_naming_it() {
    let (app_router, _) = build_test_app();
    let mut paused_input = endpoint_input("Paused app");
    paused_input["is_enabled"] = json!(false);
    let (_, paused_endpoint) = call_api(
        &app_router,
        "POST",
        "/api/v1/webhooks/endpoints",
        Some(&paused_input),
    )
    .await;
    let paused_endpoint_id = paused_endpoint["id"].as_str().unwrap_or_default();
    let email_id = send_email(&app_router, "sam@example.test", "Your receipt").await;

    let (unknown_status, unknown_refusal) =
        simulate_bounce(&app_router, &email_id, Some(vec!["wh_missing"])).await;
    let (disabled_status, disabled_refusal) =
        simulate_bounce(&app_router, &email_id, Some(vec![paused_endpoint_id])).await;

    assert_eq!(unknown_status, 422, "{unknown_refusal}");
    assert!(
        unknown_refusal["error"]["message"]
            .as_str()
            .is_some_and(|message| message.contains("wh_missing")),
        "{unknown_refusal}"
    );
    assert_eq!(disabled_status, 422, "{disabled_refusal}");
    assert!(
        disabled_refusal["error"]["message"]
            .as_str()
            .is_some_and(|message| message.contains("Paused app")),
        "{disabled_refusal}"
    );
}
