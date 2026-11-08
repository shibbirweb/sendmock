#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use std::sync::Arc;

use sendmock_ops::FixedEnvironment;
use serde_json::{Value, json};
use support::test_app::{build_test_app_with, call_api, call_api_text};

const SEED_FILE: &str = r#"[settings]
sms_simulation_profile = "manual"
sms_failure_rate_percent = 5

[[verify.services]]
sid = "VA00000000000000000000000000000001"
name = "Login"
fixed_code = "123456"

[[messaging_services]]
sid = "MG00000000000000000000000000000001"
name = "Notifications"
inbound_mode = "webhook"
inbound_url = "http://${APP_HOST}/sms/service"

[[numbers]]
number = "+15550001111"
label = "Support line"
inbound_url = "http://${APP_HOST}/sms/inbound"
messaging_service = "MG00000000000000000000000000000001"

[[sms.outcome_rules]]
pattern = "+1555777*"
outcome = "undelivered"
error_code = "30003"

[[email.outcome_rules]]
pattern = "*@bounce.qa.test"
outcome = "hard_bounce"
"#;

fn build_seeded_app() -> axum::Router {
    let environment = FixedEnvironment::default().with_variable("APP_HOST", "localhost:8000");
    let (app_router, _) = build_test_app_with(|operation_context| {
        operation_context.with_environment_reader(Arc::new(environment))
    });
    app_router
}

async fn apply_seed(app_router: &axum::Router, seed_toml: &str) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        "/api/v1/seed/apply",
        Some(&json!({ "seed_toml": seed_toml })),
    )
    .await
}

async fn list(app_router: &axum::Router, path: &str) -> Vec<Value> {
    let (status, answer) = call_api(app_router, "GET", path, None).await;
    assert_eq!(status, 200, "{path}: {answer}");
    answer
        .as_array()
        .or_else(|| answer["items"].as_array())
        .cloned()
        .unwrap_or_default()
}

async fn export_seed(app_router: &axum::Router) -> String {
    let (status, content_type, seed_toml) = call_api_text(app_router, "/api/v1/seed/export").await;
    assert_eq!(status, 200);
    assert!(
        content_type.starts_with("application/toml"),
        "{content_type}"
    );
    seed_toml
}

// AC: PL-04.1
// AC: SM-03.3 SM-07.7
#[tokio::test]
async fn applying_a_seed_creates_every_item_and_applying_it_again_changes_nothing() {
    let app_router = build_seeded_app();

    let (status, seed_validation) = apply_seed(&app_router, SEED_FILE).await;
    let first_export = export_seed(&app_router).await;
    let (second_status, _) = apply_seed(&app_router, SEED_FILE).await;

    assert_eq!(status, 200, "{seed_validation}");
    assert_eq!(second_status, 200);
    assert_eq!(export_seed(&app_router).await, first_export);
    let numbers = list(&app_router, "/api/v1/numbers").await;
    assert_eq!(numbers.len(), 1);
    assert_eq!(numbers[0]["created_by"], "seed");
    assert_eq!(
        numbers[0]["messaging_service_sid"],
        "MG00000000000000000000000000000001"
    );
    let verify_services = list(&app_router, "/api/v1/verify/services").await;
    assert_eq!(verify_services.len(), 1);
    assert_eq!(verify_services[0]["fixed_code"], "123456");
    assert_eq!(
        list(&app_router, "/api/v1/messaging-services").await.len(),
        1
    );
    assert_eq!(
        list(&app_router, "/api/v1/outcome-rules/sms").await.len(),
        1
    );
    assert_eq!(
        list(&app_router, "/api/v1/outcome-rules/email").await.len(),
        1
    );
    let (_, settings) = call_api(&app_router, "GET", "/api/v1/settings", None).await;
    assert_eq!(settings["sms_simulation_profile"], "manual");
    assert_eq!(settings["sms_failure_rate_percent"], 5);
}

// AC: PL-04.2
#[tokio::test]
async fn references_resolve_from_the_environment_and_export_never_writes_secrets() {
    let app_router = build_seeded_app();
    apply_seed(&app_router, SEED_FILE).await;
    let relay_settings = json!({ "relay_smtp_url": "smtp://mailer:s3cret@relay.test:587" });
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&relay_settings),
    )
    .await;

    let numbers = list(&app_router, "/api/v1/numbers").await;
    let exported_seed = export_seed(&app_router).await;

    assert_eq!(
        numbers[0]["inbound_url"],
        "http://localhost:8000/sms/inbound"
    );
    assert!(!exported_seed.contains("s3cret"), "{exported_seed}");
    assert!(!exported_seed.contains("relay_smtp_url"));
}

// AC: PL-04.3
#[tokio::test]
async fn reset_deletes_traffic_and_restores_exactly_the_seed() {
    let app_router = build_seeded_app();
    apply_seed(&app_router, SEED_FILE).await;
    let seeded_export = export_seed(&app_router).await;
    let number_id = list(&app_router, "/api/v1/numbers").await[0]["id"].clone();
    let edited_number = json!({
        "number": "+15550001111", "label": "Renamed", "channels": ["sms"],
        "inbound_url": null, "inbound_method": "POST", "inbound_fallback_url": null,
        "inbound_template_id": null, "status_callback_url": null, "messaging_service_sid": null,
    });
    let number_path = format!("/api/v1/numbers/{}", number_id.as_str().unwrap_or_default());
    call_api(&app_router, "PATCH", &number_path, Some(&edited_number)).await;
    let mut added_number = edited_number.clone();
    added_number["number"] = json!("+15550002222");
    call_api(&app_router, "POST", "/api/v1/numbers", Some(&added_number)).await;
    let inbound_sms = json!({ "from": "+8801700000000", "to": "+15550001111", "body": "Hi" });
    call_api(
        &app_router,
        "POST",
        "/api/v1/sms/inbound",
        Some(&inbound_sms),
    )
    .await;

    let (status, _) = call_api(&app_router, "POST", "/api/v1/reset", None).await;

    assert_eq!(status, 204);
    assert_eq!(export_seed(&app_router).await, seeded_export);
    let numbers = list(&app_router, "/api/v1/numbers").await;
    assert_eq!(numbers.len(), 1);
    assert_eq!(numbers[0]["label"], "Support line");
    assert!(list(&app_router, "/api/v1/sms").await.is_empty());
}

// AC: PL-04.4
#[tokio::test]
async fn an_exported_seed_reproduces_the_configuration_on_a_fresh_instance() {
    let first_app = build_seeded_app();
    apply_seed(&first_app, SEED_FILE).await;
    let exported_seed = export_seed(&first_app).await;

    let fresh_app = build_seeded_app();
    let (status, answer) = apply_seed(&fresh_app, &exported_seed).await;

    assert_eq!(status, 200, "{answer}\n{exported_seed}");
    assert_eq!(export_seed(&fresh_app).await, exported_seed);
}

#[tokio::test]
async fn status_lists_what_changed_since_the_seed_was_applied() {
    let app_router = build_seeded_app();
    let (_, status_before) = call_api(&app_router, "GET", "/api/v1/seed/status", None).await;
    apply_seed(&app_router, SEED_FILE).await;
    let added_service = json!({ "friendly_name": "Sandbox", "code_length": 6, "fixed_code": null, "ttl_seconds": 600 });
    call_api(
        &app_router,
        "POST",
        "/api/v1/verify/services",
        Some(&added_service),
    )
    .await;
    let new_settings = json!({ "sms_failure_rate_percent": 50 });
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&new_settings),
    )
    .await;

    let (_, seed_status) = call_api(&app_router, "GET", "/api/v1/seed/status", None).await;

    assert_eq!(
        status_before,
        json!({ "source_path": null, "applied_at": null, "changed_items": [] })
    );
    assert_eq!(seed_status["applied_at"], "2026-01-01T00:00:00Z");
    assert_eq!(
        seed_status["changed_items"],
        json!([
            { "item_kind": "Settings", "item_name": "Settings", "change": "edited" },
            { "item_kind": "Verify service", "item_name": "Sandbox", "change": "added" },
        ])
    );
}

#[tokio::test]
async fn an_invalid_file_or_a_refused_item_answers_422() {
    let app_router = build_seeded_app();

    let (syntax_status, syntax_answer) = apply_seed(&app_router, "[[mystery]]\nkey = 1\n").await;
    let (item_status, item_answer) = apply_seed(
        &app_router,
        "[[numbers]]\nnumber = \"555\"\nlabel = \"Bad\"\n",
    )
    .await;

    assert_eq!(syntax_status, 422);
    assert_eq!(syntax_answer["error"]["code"], "invalid_seed");
    assert_eq!(item_status, 422);
    let item_message = item_answer["error"]["message"].as_str().unwrap_or_default();
    assert!(
        item_message.starts_with("[[numbers]] item 1:"),
        "{item_message}"
    );
    assert!(list(&app_router, "/api/v1/numbers").await.is_empty());
}
