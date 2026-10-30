#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use support::webhook_samples::{create_endpoint, create_rule, send_email};

const RULES_PATH: &str = "/api/v1/webhooks/rules";

fn rule_input(rule_name: &str, endpoint_id: &str, filter: Value) -> Value {
    json!({
        "name": rule_name,
        "endpoint_id": endpoint_id,
        "events": ["email.received"],
        "filter": filter,
        "is_enabled": true,
    })
}

fn listed_names(rules: &Value) -> Vec<String> {
    rules
        .as_array()
        .map(|rules| {
            rules
                .iter()
                .map(|rule| {
                    format!(
                        "{}:{}",
                        rule["order"],
                        rule["name"].as_str().unwrap_or_default()
                    )
                })
                .collect()
        })
        .unwrap_or_default()
}

// AC: WH-02.4
#[tokio::test]
async fn rules_are_created_reordered_switched_off_and_deleted() {
    let (app_router, _) = build_test_app();
    let endpoint_id = create_endpoint(&app_router, "Orders app").await;
    create_rule(&app_router, &rule_input("First", &endpoint_id, Value::Null)).await;
    let second_rule = create_rule(
        &app_router,
        &rule_input("Second", &endpoint_id, Value::Null),
    )
    .await;
    let second_rule_path = format!(
        "{RULES_PATH}/{}",
        second_rule["id"].as_str().unwrap_or_default()
    );

    let (_, moved_rules) = call_api(
        &app_router,
        "POST",
        &format!("{second_rule_path}/move"),
        Some(&json!({ "direction": "up" })),
    )
    .await;
    let (patch_status, switched_off_rule) = call_api(
        &app_router,
        "PATCH",
        &second_rule_path,
        Some(&json!({ "is_enabled": false, "filter": { "field": "subject", "operator": "contains", "value": "order" } })),
    )
    .await;
    let (delete_status, _) = call_api(&app_router, "DELETE", &second_rule_path, None).await;
    let (_, remaining_rules) = call_api(&app_router, "GET", RULES_PATH, None).await;

    assert_eq!(listed_names(&moved_rules), vec!["1:Second", "2:First"]);
    assert_eq!(patch_status, 200);
    assert_eq!(switched_off_rule["is_enabled"], false);
    assert_eq!(switched_off_rule["filter"]["operator"], "contains");
    assert_eq!(switched_off_rule["events"], json!(["email.received"]));
    assert_eq!(delete_status, 204);
    assert_eq!(listed_names(&remaining_rules), vec!["1:First"]);
}

#[tokio::test]
async fn deleting_an_endpoint_deletes_its_rules() {
    let (app_router, _) = build_test_app();
    let endpoint_id = create_endpoint(&app_router, "Orders app").await;
    create_rule(&app_router, &rule_input("First", &endpoint_id, Value::Null)).await;

    call_api(
        &app_router,
        "DELETE",
        &format!("/api/v1/webhooks/endpoints/{endpoint_id}"),
        None,
    )
    .await;
    let (_, remaining_rules) = call_api(&app_router, "GET", RULES_PATH, None).await;

    assert_eq!(remaining_rules, json!([]));
}

fn condition(field: &str, operator: &str, value: &str) -> Value {
    json!({ "field": field, "operator": operator, "value": value })
}

fn rule_with_events(endpoint_id: &str, events: Value) -> Value {
    json!({ "name": "Rule", "endpoint_id": endpoint_id, "events": events, "filter": null, "is_enabled": true })
}

/// Each refused body, the field the error names and its message.
fn refused_rule_inputs(endpoint_id: &str) -> Vec<(Value, &'static str, &'static str)> {
    vec![
        (
            rule_input(" ", endpoint_id, Value::Null),
            "name",
            "Enter a name",
        ),
        (
            rule_input("Rule", "missing-endpoint", Value::Null),
            "endpoint_id",
            "Pick an endpoint",
        ),
        (
            rule_with_events(endpoint_id, json!([])),
            "events",
            "Pick at least one event",
        ),
        (
            rule_with_events(endpoint_id, json!(["webhook.delivered"])),
            "events",
            "webhook.delivered is not an event a rule can listen to",
        ),
        (
            rule_input(
                "Rule",
                endpoint_id,
                json!({ "all": [condition("color", "equals", "red")] }),
            ),
            "filter",
            "Pick a field",
        ),
        (
            rule_input(
                "Rule",
                endpoint_id,
                json!({ "not": condition("header:", "equals", "x") }),
            ),
            "filter",
            "Enter the header name",
        ),
        (
            rule_input(
                "Rule",
                endpoint_id,
                json!({ "any": [condition("subject", "contains", " ")] }),
            ),
            "filter",
            "Enter a value",
        ),
    ]
}

// AC: WH-02.5
#[tokio::test]
async fn incomplete_rules_are_refused_like_the_builder_refuses_them() {
    let (app_router, _) = build_test_app();
    let endpoint_id = create_endpoint(&app_router, "Orders app").await;

    for (refused_input, wrong_field, message) in refused_rule_inputs(&endpoint_id) {
        let (status, error_answer) =
            call_api(&app_router, "POST", RULES_PATH, Some(&refused_input)).await;

        assert_eq!(status, 400, "{refused_input}");
        assert_eq!(
            error_answer["error"]["field"], wrong_field,
            "{error_answer}"
        );
        assert_eq!(error_answer["error"]["message"], message, "{error_answer}");
    }
}

// AC: WH-02.5
#[tokio::test]
async fn an_invalid_regex_is_refused_with_the_reason() {
    let (app_router, _) = build_test_app();
    let endpoint_id = create_endpoint(&app_router, "Orders app").await;

    let (status, error_answer) = call_api(
        &app_router,
        "POST",
        RULES_PATH,
        Some(&rule_input(
            "Rule",
            &endpoint_id,
            condition("subject", "regex", "("),
        )),
    )
    .await;

    assert_eq!(status, 400);
    assert!(
        error_answer["error"]["message"]
            .as_str()
            .is_some_and(|message| message.starts_with("Invalid regex"))
    );
}

// AC: WH-02.3
#[tokio::test]
async fn the_preview_marks_which_recent_messages_would_match() {
    let (app_router, _) = build_test_app();
    send_email(&app_router, "help@support.local", "Ticket #1").await;
    send_email(&app_router, "ann@example.com", "Newsletter").await;

    let (status, preview) = call_api(
        &app_router,
        "POST",
        &format!("{RULES_PATH}/preview"),
        Some(&json!({
            "events": ["email.received"],
            "filter": { "field": "to", "operator": "matches", "value": "*@support.local" },
        })),
    )
    .await;
    let (_, sms_only_preview) = call_api(
        &app_router,
        "POST",
        &format!("{RULES_PATH}/preview"),
        Some(&json!({ "events": ["sms.sent"], "filter": null })),
    )
    .await;

    assert_eq!(status, 200, "{preview}");
    assert_eq!(preview["checked_count"], 2);
    assert_eq!(preview["match_count"], 1);
    let mut previewed_items: Vec<(String, bool)> = preview["items"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|item| {
            (
                item["title"].as_str().unwrap_or_default().to_owned(),
                item["is_match"].as_bool().unwrap_or_default(),
            )
        })
        .collect();
    previewed_items.sort();
    assert_eq!(
        previewed_items,
        vec![
            ("Newsletter".to_owned(), false),
            ("Ticket #1".to_owned(), true)
        ]
    );
    assert_eq!(sms_only_preview["checked_count"], 0);
}
