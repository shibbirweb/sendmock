#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api, call_api_text};

const FORMAT_ONE_FIXTURE: &str = include_str!("fixtures/setup/format-1.toml");

/// One item in every section that had no adapter before format 2.
const NEW_SECTIONS_SETUP: &str = r#"[sendmock]
format = "sendmock.setup"
format_version = 2

[[http.bins]]
name = "stripe"
preset = "generic"

[[http.bins.responses]]
id = "rule_rate_limited"
name = "Rate limited"
is_enabled = true
path_glob = "/v1/*"
delay_min_ms = 0
delay_max_ms = 0
failure_rate_percent = 0
failure_status_code = 500

[http.bins.responses.response]
status_code = 429
body = "slow down"

[http.bins.responses.response.headers]
retry-after = "1"

[[email.tag_rules]]
name = "Invoices"
tag = "billing"
filter = { field = "subject", operator = "contains", value = "Invoice" }

[[email.forward_rules]]
name = "To QA"
to = ["qa@example.com"]
enabled = false

[[email.inbound_routes]]
description = "Support inbox"
priority = 1
filter = { kind = "match_recipient", pattern = "^support@.*" }
actions = [{ kind = "forward_url", url = "http://localhost:8000/inbound" }, { kind = "stop" }]

[[scenarios]]
name = "Inbox check"
description = "Lists the inbox and checks it answered"

[[scenarios.steps]]
run = "email.list"
save = "inbox"

[[scenarios.steps]]
run = "assert"
with = { that = "1 > 0" }
"#;

async fn apply_setup(app_router: &axum::Router, setup_toml: &str) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        "/api/v1/seed/apply",
        Some(&json!({ "seed_toml": setup_toml })),
    )
    .await
}

async fn export_setup(app_router: &axum::Router) -> String {
    let (status, _, setup_toml) = call_api_text(app_router, "/api/v1/seed/export").await;
    assert_eq!(status, 200);
    setup_toml
}

async fn list(app_router: &axum::Router, path: &str) -> Vec<Value> {
    let (status, answer) = call_api(app_router, "GET", path, None).await;
    assert_eq!(status, 200, "{path}: {answer}");
    answer.as_array().cloned().unwrap_or_default()
}

/// A value of the `[sendmock]` header as written, without its quotes.
fn read_header_value(setup_toml: &str, header_key: &str) -> Option<String> {
    let header_lines = setup_toml
        .lines()
        .skip_while(|line| line.trim() != "[sendmock]")
        .skip(1)
        .take_while(|line| !line.trim_start().starts_with('['));
    for header_line in header_lines {
        if let Some((line_key, line_value)) = header_line.split_once('=') {
            if line_key.trim() == header_key {
                return Some(line_value.trim().trim_matches('"').to_owned());
            }
        }
    }
    None
}

// AC: PL-18.1
#[tokio::test]
async fn an_export_starts_with_the_versioned_header_and_holds_no_traffic() {
    let (app_router, _) = build_test_app();
    let sample_email = json!({ "subject": "Traffic, not configuration" });
    call_api(
        &app_router,
        "POST",
        "/api/v1/samples/email",
        Some(&sample_email),
    )
    .await;

    let exported_setup = export_setup(&app_router).await;

    let header_value = |header_key| read_header_value(&exported_setup, header_key);
    assert_eq!(header_value("format").as_deref(), Some("sendmock.setup"));
    assert_eq!(header_value("format_version").as_deref(), Some("2"));
    assert_eq!(header_value("exported_by").as_deref(), Some("0.0.0"));
    assert!(
        header_value("exported_at")
            .is_some_and(|exported_at| exported_at.starts_with("2026-01-01T00:00:00")),
        "{exported_setup}"
    );
    assert!(!exported_setup.contains("Traffic, not configuration"));
}

// AC: PL-18.1 AI-07.4
#[tokio::test]
async fn every_new_section_round_trips_through_a_fresh_instance() {
    let (first_app, _) = build_test_app();
    let (status, answer) = apply_setup(&first_app, NEW_SECTIONS_SETUP).await;
    assert_eq!(status, 200, "{answer}");
    let first_export = export_setup(&first_app).await;

    let (fresh_app, _) = build_test_app();
    let (fresh_status, fresh_answer) = apply_setup(&fresh_app, &first_export).await;

    assert_eq!(fresh_status, 200, "{fresh_answer}\n{first_export}");
    assert_eq!(export_setup(&fresh_app).await, first_export);
    for section_header in [
        "[[http.bins]]",
        "[[http.bins.responses]]",
        "[[email.tag_rules]]",
        "[[email.forward_rules]]",
        "[[email.inbound_routes]]",
        "[[scenarios]]",
        "[[scenarios.steps]]",
    ] {
        assert!(
            first_export.contains(section_header),
            "{section_header} is missing:\n{first_export}"
        );
    }
    let saved_scenarios = list(&fresh_app, "/api/v1/scenarios").await;
    assert_eq!(saved_scenarios[0]["name"], "Inbox check");
    assert_eq!(saved_scenarios[0]["created_by"], "seed");
    let inbound_routes = list(&fresh_app, "/api/v1/inbound-routes").await;
    assert_eq!(inbound_routes[0]["description"], "Support inbox");
    let bin_rules = list(&fresh_app, "/api/v1/http/bins").await;
    assert_eq!(bin_rules[0]["name"], "stripe");
}

// AC: PL-18.1 AI-07.4
#[tokio::test]
async fn reset_restores_exactly_the_new_sections_of_the_seed() {
    let (app_router, _) = build_test_app();
    apply_setup(&app_router, NEW_SECTIONS_SETUP).await;
    let seeded_export = export_setup(&app_router).await;
    let extra_scenario = json!({
        "name": "Extra",
        "scenario": "name = \"Extra\"\n[[steps]]\nrun = \"email.list\"\n",
    });
    call_api(
        &app_router,
        "POST",
        "/api/v1/scenarios",
        Some(&extra_scenario),
    )
    .await;
    let extra_bin = json!({ "name": "extra" });
    call_api(&app_router, "POST", "/api/v1/http/bins", Some(&extra_bin)).await;

    let (status, _) = call_api(&app_router, "POST", "/api/v1/reset", None).await;

    assert_eq!(status, 204);
    assert_eq!(export_setup(&app_router).await, seeded_export);
}

// AC: PL-18.2 PL-18.3
#[tokio::test]
async fn a_format_one_fixture_is_upgraded_and_applied() {
    let (app_router, _) = build_test_app();
    let fixture_before = FORMAT_ONE_FIXTURE.to_owned();

    let (status, answer) = apply_setup(&app_router, FORMAT_ONE_FIXTURE).await;

    assert_eq!(status, 200, "{answer}");
    assert_eq!(FORMAT_ONE_FIXTURE, fixture_before);
    let numbers = list(&app_router, "/api/v1/numbers").await;
    assert_eq!(numbers[0]["label"], "Support line");
    let verify_services = list(&app_router, "/api/v1/verify/services").await;
    assert_eq!(verify_services[0]["fixed_code"], "123456");
    let exported_setup = export_setup(&app_router).await;
    assert_eq!(
        read_header_value(&exported_setup, "format_version").as_deref(),
        Some("2")
    );
}

// AC: PL-18.4
#[tokio::test]
async fn a_newer_format_is_refused_before_anything_is_applied() {
    let (app_router, _) = build_test_app();
    let newer_setup = "[sendmock]\nformat = \"sendmock.setup\"\nformat_version = 99\nexported_by = \"9.0.0\"\n\n[[numbers]]\nnumber = \"+15550001111\"\n\n[[future.section]]\nname = \"later\"\n";

    let (status, answer) = apply_setup(&app_router, newer_setup).await;

    assert_eq!(status, 422, "{answer}");
    assert_eq!(answer["error"]["code"], "setup_too_new");
    let message = answer["error"]["message"].as_str().unwrap_or_default();
    assert!(
        message.contains("exported by SendMock 9.0.0 (format 99)")
            && message.contains("this is SendMock 0.0.0 (format 2)")
            && message.contains("Update SendMock to 9.0.0 or later"),
        "{message}"
    );
    assert!(list(&app_router, "/api/v1/numbers").await.is_empty());
}
