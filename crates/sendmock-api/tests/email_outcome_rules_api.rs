#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use support::webhook_samples::send_email;
use tower::ServiceExt;

const RULES_PATH: &str = "/api/v1/outcome-rules/email";

fn outcome_rule(pattern: &str, outcome: &str, smtp_code: Option<&str>) -> Value {
    json!({
        "pattern": pattern,
        "outcome": outcome,
        "smtp_code": smtp_code,
        "diagnostic": null,
        "note": "",
        "is_enabled": true,
    })
}

async fn create_rule(app_router: &axum::Router, rule_input: &Value) -> Value {
    let (status, created_rule) = call_api(app_router, "POST", RULES_PATH, Some(rule_input)).await;
    assert_eq!(status, 201, "{created_rule}");
    created_rule
}

fn rule_path(outcome_rule: &Value) -> String {
    format!(
        "{RULES_PATH}/{}",
        outcome_rule["id"].as_str().unwrap_or_default()
    )
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

async fn test_address(app_router: &axum::Router, address: &str) -> Value {
    let (status, test_result) = call_api(
        app_router,
        "POST",
        &format!("{RULES_PATH}/test"),
        Some(&json!({ "address": address })),
    )
    .await;
    assert_eq!(status, 200, "{test_result}");
    test_result
}

/// `POST /api/v1/send/raw` with the message as the body, as the sendmail shim sends it.
async fn send_raw_message(app_router: &axum::Router, raw_message: &str) -> u16 {
    let request = Request::builder()
        .method("POST")
        .uri("/api/v1/send/raw")
        .header("content-type", "message/rfc822")
        .body(Body::from(raw_message.to_owned()))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    response.status().as_u16()
}

async fn read_email(app_router: &axum::Router, email_id: &str) -> Value {
    let (_, email) = call_api(
        app_router,
        "GET",
        &format!("/api/v1/emails/{email_id}"),
        None,
    )
    .await;
    email
}

// AC: EM-10.5
#[tokio::test]
async fn rules_are_created_edited_moved_switched_off_and_deleted() {
    let (app_router, _) = build_test_app();
    let first_rule = create_rule(
        &app_router,
        &outcome_rule("*@bounce.qa.test", "hard_bounce", Some("550 5.1.1")),
    )
    .await;
    let second_rule = create_rule(
        &app_router,
        &outcome_rule("vip@shop.test", "delivered", None),
    )
    .await;

    let (_, moved_rules) = call_api(
        &app_router,
        "POST",
        &format!("{}/move", rule_path(&second_rule)),
        Some(&json!({ "direction": "up" })),
    )
    .await;
    let (patch_status, switched_off_rule) = call_api(
        &app_router,
        "PATCH",
        &rule_path(&second_rule),
        Some(&json!({ "is_enabled": false, "note": "VIP inbox" })),
    )
    .await;
    let (delete_status, _) = call_api(&app_router, "DELETE", &rule_path(&first_rule), None).await;
    let (_, remaining_rules) = call_api(&app_router, "GET", RULES_PATH, None).await;

    assert_eq!(first_rule["position"], 1);
    assert_eq!(first_rule["created_by"], "api");
    assert_eq!(first_rule["smtp_code"], "550 5.1.1");
    assert_eq!(
        listed_patterns(&moved_rules),
        vec!["vip@shop.test", "*@bounce.qa.test"]
    );
    assert_eq!(patch_status, 200);
    assert_eq!(switched_off_rule["is_enabled"], false);
    assert_eq!(switched_off_rule["note"], "VIP inbox");
    assert_eq!(delete_status, 204);
    assert_eq!(listed_patterns(&remaining_rules), vec!["vip@shop.test"]);
    assert_eq!(remaining_rules[0]["position"], 1);
}

// AC: EM-10.5
#[tokio::test]
async fn the_pattern_code_diagnostic_and_note_rules_are_enforced() {
    let (app_router, _) = build_test_app();
    let mut two_line_diagnostic = outcome_rule("qa@shop.test", "reject", None);
    two_line_diagnostic["diagnostic"] = json!("denied\r\n250 OK");
    let mut long_note = outcome_rule("qa@shop.test", "delivered", None);
    long_note["note"] = json!("x".repeat(121));

    let cases = [
        (outcome_rule("qa.shop.test", "delivered", None), "pattern"),
        (
            outcome_rule("qa@shop.test", "hard_bounce", Some("250 2.0.0")),
            "smtp_code",
        ),
        (
            outcome_rule("qa@shop.test", "reject", Some("550 4.1.1")),
            "smtp_code",
        ),
        (two_line_diagnostic, "diagnostic"),
        (long_note, "note"),
    ];
    for (rule_input, expected_field) in cases {
        let (status, error_body) =
            call_api(&app_router, "POST", RULES_PATH, Some(&rule_input)).await;
        assert_eq!(status, 400, "{rule_input}");
        assert_eq!(error_body["error"]["field"], expected_field);
    }
    let (missing_status, _) = call_api(
        &app_router,
        "PATCH",
        &format!("{RULES_PATH}/missing"),
        Some(&json!({ "note": "x" })),
    )
    .await;
    let (missing_move_status, _) = call_api(
        &app_router,
        "POST",
        &format!("{RULES_PATH}/missing/move"),
        Some(&json!({ "direction": "down" })),
    )
    .await;
    assert_eq!(missing_status, 404);
    assert_eq!(missing_move_status, 404);
}

#[tokio::test]
async fn an_outcome_without_an_smtp_reply_drops_the_code_and_diagnostic() {
    let (app_router, _) = build_test_app();
    let mut complaint_input = outcome_rule(" qa@shop.test ", "complaint", Some("550 5.1.1"));
    complaint_input["diagnostic"] = json!("ignored");

    let created_rule = create_rule(&app_router, &complaint_input).await;

    assert_eq!(created_rule["pattern"], "qa@shop.test");
    assert_eq!(created_rule["smtp_code"], Value::Null);
    assert_eq!(created_rule["diagnostic"], Value::Null);
}

// AC: EM-10.5
#[tokio::test]
async fn the_first_enabled_matching_rule_wins_over_a_magic_address() {
    let (app_router, _) = build_test_app();
    let mut switched_off = outcome_rule("bounce@shop.test", "complaint", None);
    switched_off["is_enabled"] = json!(false);
    create_rule(&app_router, &switched_off).await;
    create_rule(&app_router, &outcome_rule("bounce@*", "delivered", None)).await;
    let mut hard_bounce = outcome_rule("*@bounce.qa.test", "hard_bounce", Some("550 5.1.10"));
    hard_bounce["diagnostic"] = json!("no such mailbox");
    create_rule(&app_router, &hard_bounce).await;

    let magic_email_id = send_email(&app_router, "bounce@shop.test", "Welcome").await;
    let bounced_email_id = send_email(&app_router, "sam@bounce.qa.test", "Welcome").await;

    assert_eq!(
        read_email(&app_router, &magic_email_id).await["delivery_status"],
        "delivered"
    );
    let (_, timeline) = call_api(
        &app_router,
        "GET",
        &format!("/api/v1/emails/{bounced_email_id}/timeline"),
        None,
    )
    .await;
    let bounce_entry = timeline
        .as_array()
        .and_then(|entries| entries.iter().find(|entry| entry["kind"] == "bounced"))
        .map(|entry| entry["detail"].clone());
    assert_eq!(
        bounce_entry,
        Some(json!(
            "sam@bounce.qa.test: hard bounce, 550 5.1.10 no such mailbox (custom rule 3)"
        ))
    );
}

// AC: EM-10.5
#[tokio::test]
async fn a_reject_rule_refuses_the_http_sends_and_stores_nothing() {
    let (app_router, _) = build_test_app();
    create_rule(&app_router, &outcome_rule("*@blocked.test", "reject", None)).await;

    let (send_status, send_error) = call_api(
        &app_router,
        "POST",
        "/api/v1/send",
        Some(&json!({
            "from": "no-reply@shop.test", "to": ["ok@shop.test"], "cc": ["Kim <kim@Blocked.test>"],
            "subject": "Hi", "text": "Hello",
        })),
    )
    .await;
    let raw_status = send_raw_message(
        &app_router,
        "From: no-reply@shop.test\r\nTo: sam@blocked.test\r\nSubject: Hi\r\n\r\nHello\r\n",
    )
    .await;
    let (_, stored_emails) = call_api(&app_router, "GET", "/api/v1/emails", None).await;

    assert_eq!(send_status, 400);
    assert_eq!(
        send_error["error"]["message"],
        "kim@Blocked.test rejected with 550 5.7.1 recipient rejected (custom rule 1)"
    );
    assert_eq!(raw_status, 400);
    assert_eq!(stored_emails["total_count"], 0, "{stored_emails}");
}

// AC: EM-10.6
#[tokio::test]
async fn the_tester_names_the_rule_magic_address_or_profile_that_applies() {
    let (app_router, _) = build_test_app();
    create_rule(
        &app_router,
        &outcome_rule("qa+*@shop.test", "soft_bounce", Some("452 4.2.2")),
    )
    .await;

    let custom_result = test_address(&app_router, "QA+signup@shop.test").await;
    let magic_result = test_address(&app_router, "bounce@shop.test").await;
    let profile_result = test_address(&app_router, "sam@shop.test").await;

    assert_eq!(custom_result["source"], "custom");
    assert_eq!(custom_result["rule_position"], 1);
    assert_eq!(
        custom_result["summary"],
        "Custom rule 1: Soft bounce (deferred), 452 4.2.2"
    );
    assert_eq!(magic_result["source"], "magic");
    assert_eq!(magic_result["rule_id"], Value::Null);
    assert_eq!(
        magic_result["summary"],
        "Magic address: Hard bounce (550 5.1.1)"
    );
    assert_eq!(profile_result["source"], "profile");
    assert_eq!(
        profile_result["summary"],
        "No rule or magic address matches: the off outcome profile applies."
    );
}

// AC: EM-10.6
#[tokio::test]
async fn with_magic_addresses_off_the_tester_falls_through_to_the_profile() {
    let (app_router, _) = build_test_app();
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "is_magic_addresses_enabled": false, "email_outcome_profile": "auto-delivered" })),
    )
    .await;

    let test_result = test_address(&app_router, "bounce@shop.test").await;

    assert_eq!(test_result["source"], "profile");
    assert_eq!(
        test_result["summary"],
        "No rule or magic address matches: the auto-delivered outcome profile applies."
    );
}
