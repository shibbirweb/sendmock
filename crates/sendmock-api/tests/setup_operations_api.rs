#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

const FORMAT_ONE_FIXTURE: &str = include_str!("fixtures/setup/format-1.toml");

const TWO_NUMBERS_SETUP: &str = r#"[sendmock]
format = "sendmock.setup"
format_version = 2

[settings]
sms_failure_rate_percent = 5

[[numbers]]
number = "+15550001111"
label = "Support line"

[[numbers]]
number = "+15550002222"
label = "Sales line"

[[webhook.endpoints]]
name = "Billing"
url = "http://localhost:8000/hook"
"#;

/// A POST whose answer is a file; answers the status, the content type, the
/// `content-disposition` and the body text.
async fn post_for_file(
    app_router: &axum::Router,
    path: &str,
    json_body: &Value,
) -> (u16, String, String, String) {
    let request = Request::builder()
        .method("POST")
        .uri(path)
        .header("content-type", "application/json")
        .body(Body::from(json_body.to_string()))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let read_header = |header_name: &str| {
        response
            .headers()
            .get(header_name)
            .and_then(|header_value| header_value.to_str().ok())
            .unwrap_or_default()
            .to_owned()
    };
    let (status, content_type, disposition) = (
        response.status().as_u16(),
        read_header("content-type"),
        read_header("content-disposition"),
    );
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    (
        status,
        content_type,
        disposition,
        String::from_utf8_lossy(&body_bytes).into_owned(),
    )
}

async fn import_setup(app_router: &axum::Router, import_body: &Value) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        "/api/v1/setup/import",
        Some(import_body),
    )
    .await
}

async fn validate_setup(app_router: &axum::Router, validate_body: &Value) -> Value {
    let (status, answer) = call_api(
        app_router,
        "POST",
        "/api/v1/setup/validate",
        Some(validate_body),
    )
    .await;
    assert_eq!(status, 200, "{answer}");
    answer
}

/// An instance holding `TWO_NUMBERS_SETUP`.
async fn build_seeded_app() -> axum::Router {
    let (app_router, _) = build_test_app();
    let (status, answer) =
        import_setup(&app_router, &json!({ "setup_text": TWO_NUMBERS_SETUP })).await;
    assert_eq!(status, 200, "{answer}");
    app_router
}

fn find_section_change<'answer>(validation: &'answer Value, section: &str) -> &'answer Value {
    validation["changes"]
        .as_array()
        .and_then(|changes| changes.iter().find(|change| change["section"] == section))
        .unwrap_or(&Value::Null)
}

// AC: PL-18.1 PL-18.5
#[tokio::test]
async fn exports_in_each_format_with_a_matching_file_name_and_only_the_chosen_sections() {
    let app_router = build_seeded_app().await;

    for (format_name, content_type) in [
        ("toml", "application/toml"),
        ("json", "application/json"),
        ("yaml", "application/yaml"),
    ] {
        let (status, answer_type, disposition, setup_text) = post_for_file(
            &app_router,
            "/api/v1/setup/export",
            &json!({ "format": format_name, "only": ["numbers"] }),
        )
        .await;

        assert_eq!(status, 200, "{setup_text}");
        assert!(answer_type.starts_with(content_type), "{answer_type}");
        assert!(
            disposition.contains(&format!("sendmock.setup.{format_name}")),
            "{disposition}"
        );
        assert!(setup_text.contains("+15550001111"), "{setup_text}");
        assert!(setup_text.contains("sendmock.setup"), "{setup_text}");
        assert!(!setup_text.contains("Billing"), "{setup_text}");
    }
}

// AC: PL-18.6
#[tokio::test]
async fn an_export_with_secrets_needs_a_passphrase() {
    let app_router = build_seeded_app().await;

    let (status, answer) = call_api(
        &app_router,
        "POST",
        "/api/v1/setup/export",
        Some(&json!({ "include_secrets": true })),
    )
    .await;
    let (_, _, _, encrypted_setup) = post_for_file(
        &app_router,
        "/api/v1/setup/export",
        &json!({ "include_secrets": true, "passphrase": "correct horse battery" }),
    )
    .await;
    let (_, _, _, referenced_setup) = post_for_file(
        &app_router,
        "/api/v1/setup/export",
        &json!({ "passphrase": "correct horse battery" }),
    )
    .await;

    assert_eq!(status, 400, "{answer}");
    assert_eq!(answer["error"]["field"], "passphrase");
    assert!(
        encrypted_setup.contains("secret = \"encrypted:v1:"),
        "{encrypted_setup}"
    );
    assert!(
        referenced_setup.contains("${BILLING_SECRET}"),
        "{referenced_setup}"
    );
}

#[tokio::test]
async fn an_unknown_section_name_is_refused() {
    let (app_router, _) = build_test_app();

    let (status, answer) = call_api(
        &app_router,
        "POST",
        "/api/v1/setup/export",
        Some(&json!({ "except": ["webhooks"] })),
    )
    .await;

    assert_eq!(status, 400, "{answer}");
    assert_eq!(answer["error"]["field"], "except");
}

// AC: PL-18.8
#[tokio::test]
async fn validation_lists_what_a_merge_or_a_replace_would_add_change_and_remove() {
    let app_router = build_seeded_app().await;
    let next_setup = "[[numbers]]\nnumber = \"+15550001111\"\nlabel = \"Support desk\"\n\n[[numbers]]\nnumber = \"+15550003333\"\nlabel = \"New line\"\n";

    let merge_preview = validate_setup(&app_router, &json!({ "setup_text": next_setup })).await;
    let replace_preview = validate_setup(
        &app_router,
        &json!({ "setup_text": next_setup, "mode": "replace" }),
    )
    .await;

    assert_eq!(merge_preview["is_valid"], true, "{merge_preview}");
    let merge_numbers = find_section_change(&merge_preview, "numbers");
    assert_eq!(merge_numbers["added"], json!(["+15550003333"]));
    assert_eq!(merge_numbers["changed"], json!(["+15550001111"]));
    assert_eq!(merge_numbers["removed"], json!([]));
    assert_eq!(merge_preview["removed_count"], 0);
    let replace_numbers = find_section_change(&replace_preview, "numbers");
    assert_eq!(replace_numbers["removed"], json!(["+15550002222"]));
    assert_eq!(
        find_section_change(&replace_preview, "webhook.endpoints")["removed"],
        json!(["Billing"])
    );
    assert_eq!(
        find_section_change(&replace_preview, "settings")["changed"],
        json!(["Settings"])
    );
    assert_eq!(replace_preview["removed_count"], 2);
}

// AC: PL-18.8
#[tokio::test]
async fn validation_of_an_export_of_the_same_instance_lists_no_change() {
    let app_router = build_seeded_app().await;
    let (_, _, _, exported_setup) =
        post_for_file(&app_router, "/api/v1/setup/export", &json!({})).await;

    let preview = validate_setup(
        &app_router,
        &json!({ "setup_text": exported_setup, "mode": "replace" }),
    )
    .await;

    assert_eq!(preview["is_valid"], true, "{preview}");
    assert_eq!(preview["changes"], json!([]), "{exported_setup}");
}

// AC: PL-18.3 PL-18.4
#[tokio::test]
async fn validation_names_the_format_version_an_upgrade_and_a_refusal() {
    let (app_router, _) = build_test_app();
    let newer_setup =
        "[sendmock]\nformat = \"sendmock.setup\"\nformat_version = 99\nexported_by = \"9.0.0\"\n";

    let upgraded = validate_setup(&app_router, &json!({ "setup_text": FORMAT_ONE_FIXTURE })).await;
    let refused = validate_setup(&app_router, &json!({ "setup_text": newer_setup })).await;
    let broken = validate_setup(
        &app_router,
        &json!({ "setup_text": "[[numbers]]\nnumber = \"+1555\"\n[[mystery]]\nkey = 1\n" }),
    )
    .await;

    assert_eq!(upgraded["is_valid"], true, "{upgraded}");
    assert_eq!(upgraded["format_version"], 1);
    assert_eq!(upgraded["upgraded_from_format_version"], 1);
    assert_eq!(refused["is_valid"], false);
    let refusal = refused["errors"][0]["message"].as_str().unwrap_or_default();
    assert!(refusal.contains("format 99"), "{refusal}");
    assert_eq!(broken["is_valid"], false);
    assert_eq!(broken["errors"][0]["line"], 3, "{broken}");
}

// AC: PL-18.3
#[tokio::test]
async fn migrate_writes_the_upgraded_copy_in_the_chosen_format() {
    let (app_router, _) = build_test_app();

    let (status, content_type, _, migrated_setup) = post_for_file(
        &app_router,
        "/api/v1/setup/migrate",
        &json!({ "setup_text": FORMAT_ONE_FIXTURE, "to_format": "json" }),
    )
    .await;

    assert_eq!(status, 200, "{migrated_setup}");
    assert!(
        content_type.starts_with("application/json"),
        "{content_type}"
    );
    let migrated_document: Value = serde_json::from_str(&migrated_setup)
        .unwrap_or_else(|error| panic!("JSON: {error}\n{migrated_setup}"));
    assert_eq!(migrated_document["sendmock"]["format_version"], 2);
    assert_eq!(migrated_document["sendmock"]["format"], "sendmock.setup");
}
