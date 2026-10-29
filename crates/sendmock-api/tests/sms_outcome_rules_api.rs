#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

fn outcome_rule(pattern: &str, outcome: &str, error_code: Option<&str>) -> Value {
    json!({
        "match_field": "to",
        "pattern": pattern,
        "outcome": outcome,
        "error_code": error_code,
        "delay_seconds": null,
        "note": "",
        "is_enabled": true,
    })
}

async fn create_rule(app_router: &axum::Router, rule_input: &Value) -> Value {
    let (status, created_rule) = call_api(
        app_router,
        "POST",
        "/api/v1/outcome-rules/sms",
        Some(rule_input),
    )
    .await;
    assert_eq!(status, 201, "{created_rule}");
    created_rule
}

fn listed_patterns(rules: &Value) -> Vec<String> {
    rules
        .as_array()
        .map(|rules| {
            rules
                .iter()
                .map(|rule| rule["pattern"].as_str().unwrap_or_default().to_owned())
                .collect()
        })
        .unwrap_or_default()
}

// AC: SM-07.7
#[tokio::test]
async fn rules_are_created_edited_moved_switched_off_and_deleted() {
    let (app_router, _) = build_test_app();
    let first_rule = create_rule(
        &app_router,
        &outcome_rule("+1555000*", "failed", Some("30008")),
    )
    .await;
    let second_rule = create_rule(&app_router, &outcome_rule("+1555111*", "read", None)).await;
    let second_rule_path = format!(
        "/api/v1/outcome-rules/sms/{}",
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
        Some(&json!({ "is_enabled": false, "note": "QA phone" })),
    )
    .await;
    let first_rule_path = format!(
        "/api/v1/outcome-rules/sms/{}",
        first_rule["id"].as_str().unwrap_or_default()
    );
    let (delete_status, _) = call_api(&app_router, "DELETE", &first_rule_path, None).await;
    let (_, remaining_rules) =
        call_api(&app_router, "GET", "/api/v1/outcome-rules/sms", None).await;

    assert_eq!(first_rule["position"], 1);
    assert_eq!(first_rule["created_by"], "api");
    assert_eq!(
        listed_patterns(&moved_rules),
        vec!["+1555111*", "+1555000*"]
    );
    assert_eq!(patch_status, 200);
    assert_eq!(switched_off_rule["is_enabled"], false);
    assert_eq!(switched_off_rule["note"], "QA phone");
    assert_eq!(delete_status, 204);
    assert_eq!(listed_patterns(&remaining_rules), vec!["+1555111*"]);
    assert_eq!(remaining_rules[0]["position"], 1);
}

// AC: SM-07.7
#[tokio::test]
async fn the_code_delay_and_pattern_rules_are_enforced() {
    let (app_router, _) = build_test_app();
    let mut delayed_without_delay = outcome_rule("+1555000*", "delayed_delivery", None);
    delayed_without_delay["delay_seconds"] = json!(0);

    let cases = [
        (outcome_rule("+1555000*", "undelivered", None), "error_code"),
        (outcome_rule("+1-555", "failed", Some("30008")), "pattern"),
        (delayed_without_delay, "delay_seconds"),
    ];
    for (rule_input, expected_field) in cases {
        let (status, error_body) = call_api(
            &app_router,
            "POST",
            "/api/v1/outcome-rules/sms",
            Some(&rule_input),
        )
        .await;
        assert_eq!(status, 400);
        assert_eq!(error_body["error"]["field"], expected_field);
    }
    let (missing_status, _) = call_api(
        &app_router,
        "PATCH",
        "/api/v1/outcome-rules/sms/missing",
        Some(&json!({ "note": "x" })),
    )
    .await;
    assert_eq!(missing_status, 404);
}

// AC: SM-07.8
#[tokio::test]
async fn a_custom_rule_wins_over_a_magic_number_and_plays_its_outcome() {
    let (app_router, _) = build_test_app();
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "sms_simulation_profile": "instant" })),
    )
    .await;
    create_rule(
        &app_router,
        &outcome_rule("+150055500*", "undelivered", Some("30005")),
    )
    .await;
    let mut switched_off = outcome_rule("+15005550001", "reject", Some("21610"));
    switched_off["is_enabled"] = json!(false);
    create_rule(&app_router, &switched_off).await;

    let (status, sent_sms) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms",
        Some(&json!({ "from": "+15550001111", "to": "+15005550001", "body": "Hi" })),
    )
    .await;
    let (_, test_result) = call_api(
        &app_router,
        "POST",
        "/api/v1/outcome-rules/sms/test",
        Some(&json!({ "number": "+15005550001", "match_field": "to" })),
    )
    .await;

    assert_eq!(status, 201);
    assert_eq!(sent_sms["status"], "undelivered");
    assert_eq!(sent_sms["error_code"], "30005");
    assert_eq!(test_result["source"], "custom");
    assert_eq!(test_result["rule_position"], 1);
    assert_eq!(
        test_result["summary"],
        "Custom rule 1: Accepted, then undelivered, 30005"
    );
}

// AC: SM-07.8
#[tokio::test]
async fn a_custom_reject_rule_refuses_the_send() {
    let (app_router, _) = build_test_app();
    create_rule(
        &app_router,
        &outcome_rule("+8801*", "reject", Some("21610")),
    )
    .await;

    let (status, error_body) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms",
        Some(&json!({ "from": "+15550001111", "to": "+8801700000000", "body": "Hi" })),
    )
    .await;

    assert_eq!(status, 400);
    assert_eq!(
        error_body["error"]["message"],
        "Rejected with error 21610 (custom rule 1)"
    );
}
