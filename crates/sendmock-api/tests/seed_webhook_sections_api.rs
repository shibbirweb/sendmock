#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use std::sync::Arc;

use sendmock_ops::FixedEnvironment;
use serde_json::{Value, json};
use support::test_app::{build_test_app_with, call_api, call_api_text};

const SEEDED_SECRET: &str = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

const SEED_FILE: &str = r#"[[webhook.templates]]
id = "custom.orders"
name = "Orders"
events = ["email.received"]

[webhook.templates.request]
method = "POST"
content_type = "application/json"
body = '{"subject": "{{ data.subject }}"}'

[[webhook.endpoints]]
name = "Laravel inbound mail"
url = "http://localhost:8000/webhooks/mail"
template = "custom.orders"
secret = "${LARAVEL_INBOUND_MAIL_SECRET}"
timeout_ms = 5000

[[webhook.variables]]
name = "signing_key"
kind = "secret"
value = "${SIGNING_KEY}"

[[webhook.variables]]
name = "tenant"
kind = "text"
endpoint = "Laravel inbound mail"
value = "acme"

[[webhook.rules]]
name = "Inbound mail"
endpoint = "Laravel inbound mail"
events = ["email.received"]
filter = { all = [{ field = "to", operator = "matches", value = "*@inbound.local" }] }

[[webhook.saved]]
name = "Order shipped"
endpoint = "Laravel inbound mail"
event = "email.received"
template = "custom.orders"
url = "http://localhost:8000/webhooks/mail"
headers = { "Content-Type" = "application/json" }
body = '{"subject": "Shipped"}'
"#;

fn build_seeded_app() -> axum::Router {
    let environment = FixedEnvironment::default()
        .with_variable("LARAVEL_INBOUND_MAIL_SECRET", SEEDED_SECRET)
        .with_variable("SIGNING_KEY", "key-from-env")
        .with_variable("SIGNING_KEY_SECRET", "key-from-env")
        .with_variable("VONAGE_API_SECRET_SECRET", "vonage-from-env");
    let (app_router, _) = build_test_app_with(|operation_context| {
        operation_context.with_environment_reader(Arc::new(environment))
    });
    app_router
}

async fn apply_seed(app_router: &axum::Router, seed_toml: &str) -> Value {
    let (status, answer) = call_api(
        app_router,
        "POST",
        "/api/v1/seed/apply",
        Some(&json!({ "seed_toml": seed_toml })),
    )
    .await;
    assert_eq!(status, 200, "{answer}");
    answer
}

async fn get(app_router: &axum::Router, path: &str) -> Value {
    let (status, answer) = call_api(app_router, "GET", path, None).await;
    assert_eq!(status, 200, "{path}: {answer}");
    answer
}

fn items(answer: &Value) -> Vec<Value> {
    answer
        .as_array()
        .or_else(|| answer["items"].as_array())
        .cloned()
        .unwrap_or_default()
}

async fn export_seed(app_router: &axum::Router) -> String {
    let (status, _, seed_toml) = call_api_text(app_router, "/api/v1/seed/export").await;
    assert_eq!(status, 200);
    seed_toml
}

async fn reveal_endpoint_secret(app_router: &axum::Router) -> Value {
    let endpoints = items(&get(app_router, "/api/v1/webhooks/endpoints").await);
    let endpoint_id = endpoints[0]["id"].as_str().unwrap_or_default().to_owned();
    get(
        app_router,
        &format!("/api/v1/webhooks/endpoints/{endpoint_id}/secret"),
    )
    .await["secret"]
        .clone()
}

// AC: PL-04.1
#[tokio::test]
async fn the_webhook_sections_are_applied_and_applying_again_changes_nothing() {
    let app_router = build_seeded_app();

    apply_seed(&app_router, SEED_FILE).await;
    let first_export = export_seed(&app_router).await;
    apply_seed(&app_router, SEED_FILE).await;

    assert_eq!(export_seed(&app_router).await, first_export);
    let endpoints = items(&get(&app_router, "/api/v1/webhooks/endpoints").await);
    assert_eq!(endpoints.len(), 1);
    assert_eq!(endpoints[0]["template_id"], "custom.orders");
    assert_eq!(endpoints[0]["timeout_ms"], 5000);
    let rules = items(&get(&app_router, "/api/v1/webhooks/rules").await);
    assert_eq!(rules.len(), 1);
    assert_eq!(rules[0]["endpoint_id"], endpoints[0]["id"]);
    assert_eq!(rules[0]["created_by"], "seed");
    assert_eq!(
        items(&get(&app_router, "/api/v1/webhooks/variables").await).len(),
        2
    );
    let saved_deliveries = items(&get(&app_router, "/api/v1/webhooks/saved").await);
    assert_eq!(saved_deliveries.len(), 1);
    assert_eq!(
        saved_deliveries[0]["request"]["body"],
        "{\"subject\": \"Shipped\"}"
    );
    let template = get(&app_router, "/api/v1/webhooks/templates/custom.orders").await;
    assert_eq!(template["revision"], 1);
}

// AC: PL-04.2
#[tokio::test]
async fn secrets_come_from_the_environment_and_export_writes_only_references() {
    let app_router = build_seeded_app();
    apply_seed(&app_router, SEED_FILE).await;

    let exported_seed = export_seed(&app_router).await;

    assert_eq!(reveal_endpoint_secret(&app_router).await, SEEDED_SECRET);
    assert!(!exported_seed.contains(SEEDED_SECRET), "{exported_seed}");
    assert!(!exported_seed.contains("key-from-env"));
    assert!(exported_seed.contains("secret = \"${LARAVEL_INBOUND_MAIL_SECRET}\""));
    assert!(exported_seed.contains("value = \"${SIGNING_KEY_SECRET}\""));
}

/// Turns the seeded rule off, rotates the endpoint's secret and adds a variable.
async fn change_seeded_webhooks(app_router: &axum::Router) {
    let rule_id = items(&get(app_router, "/api/v1/webhooks/rules").await)[0]["id"].clone();
    let rule_path = format!(
        "/api/v1/webhooks/rules/{}",
        rule_id.as_str().unwrap_or_default()
    );
    call_api(
        app_router,
        "PATCH",
        &rule_path,
        Some(&json!({ "is_enabled": false })),
    )
    .await;
    let rotate_path = format!(
        "/api/v1/webhooks/endpoints/{}/rotate-secret",
        items(&get(app_router, "/api/v1/webhooks/endpoints").await)[0]["id"]
            .as_str()
            .unwrap_or_default()
    );
    call_api(
        app_router,
        "POST",
        &rotate_path,
        Some(&json!({ "overlap_hours": 0 })),
    )
    .await;
    let extra_variable = json!({
        "name": "extra", "kind": "text", "scope": "global", "endpoint_id": null,
        "value": "x", "random_mode": null, "description": "",
    });
    call_api(
        app_router,
        "POST",
        "/api/v1/webhooks/variables",
        Some(&extra_variable),
    )
    .await;
}

// AC: PL-04.3
#[tokio::test]
async fn reset_restores_the_seeded_webhooks_and_deletes_the_others() {
    let app_router = build_seeded_app();
    apply_seed(&app_router, SEED_FILE).await;
    let seeded_export = export_seed(&app_router).await;
    change_seeded_webhooks(&app_router).await;

    let (status, _) = call_api(&app_router, "POST", "/api/v1/reset", None).await;

    assert_eq!(status, 204);
    assert_eq!(export_seed(&app_router).await, seeded_export);
    assert_eq!(reveal_endpoint_secret(&app_router).await, SEEDED_SECRET);
    assert_eq!(
        items(&get(&app_router, "/api/v1/webhooks/variables").await).len(),
        2
    );
    assert_eq!(
        items(&get(&app_router, "/api/v1/webhooks/saved").await).len(),
        1
    );
}

/// Edits one built-in provider and removes another, as the seed file then records them.
async fn rename_vonage_and_remove_messagebird(app_router: &axum::Router) {
    let mut vonage = get(app_router, "/api/v1/sms/providers/vonage").await;
    if let Some(fields) = vonage.as_object_mut() {
        for read_only_field in [
            "area",
            "is_builtin",
            "is_modified",
            "is_removed",
            "message_count_24h",
        ] {
            fields.remove(read_only_field);
        }
    }
    vonage["name"] = json!("Vonage (staging)");
    call_api(
        app_router,
        "PATCH",
        "/api/v1/sms/providers/vonage",
        Some(&vonage),
    )
    .await;
    call_api(
        app_router,
        "DELETE",
        "/api/v1/sms/providers/messagebird",
        None,
    )
    .await;
}

// AC: PL-04.4
// AC: SM-16.7
#[tokio::test]
async fn an_export_with_webhooks_and_an_edited_provider_reproduces_on_a_fresh_instance() {
    let first_app = build_seeded_app();
    apply_seed(&first_app, SEED_FILE).await;
    rename_vonage_and_remove_messagebird(&first_app).await;
    let exported_seed = export_seed(&first_app).await;

    let fresh_app = build_seeded_app();
    apply_seed(&fresh_app, &exported_seed).await;

    assert_eq!(export_seed(&fresh_app).await, exported_seed);
    assert!(
        exported_seed.contains("${VONAGE_API_SECRET_SECRET}"),
        "{exported_seed}"
    );
    let fresh_vonage = get(&fresh_app, "/api/v1/sms/providers/vonage").await;
    assert_eq!(fresh_vonage["name"], "Vonage (staging)");
    let revealed_secret = get(
        &fresh_app,
        "/api/v1/sms/providers/vonage/credentials/api_secret",
    )
    .await;
    assert_eq!(revealed_secret["value"], "vonage-from-env");
    let messagebird = get(&fresh_app, "/api/v1/sms/providers/messagebird").await;
    assert_eq!(messagebird["is_removed"], true);
}

#[tokio::test]
async fn a_refused_item_names_the_environment_variables_that_are_not_set() {
    let app_router = build_seeded_app();
    let seed_toml = "[[webhook.variables]]\nname = \"api_key\"\nkind = \"secret\"\nvalue = \"${API_KEY_SECRET}\"\n";

    let (status, answer) = call_api(
        &app_router,
        "POST",
        "/api/v1/seed/apply",
        Some(&json!({ "seed_toml": seed_toml })),
    )
    .await;

    assert_eq!(status, 422);
    let message = answer["error"]["message"].as_str().unwrap_or_default();
    assert!(
        message.ends_with("(not set in the environment: API_KEY_SECRET)"),
        "{message}"
    );
}

#[tokio::test]
async fn a_rule_naming_an_unknown_endpoint_answers_422() {
    let app_router = build_seeded_app();

    let (status, answer) = call_api(
        &app_router,
        "POST",
        "/api/v1/seed/apply",
        Some(&json!({ "seed_toml": "[[webhook.rules]]\nname = \"Lost\"\nendpoint = \"Nowhere\"\nevents = [\"email.received\"]\n" })),
    )
    .await;

    assert_eq!(status, 422);
    let message = answer["error"]["message"].as_str().unwrap_or_default();
    assert!(message.starts_with("[[webhook.rules]] item 1"), "{message}");
    assert!(message.contains("Nowhere"));
}
