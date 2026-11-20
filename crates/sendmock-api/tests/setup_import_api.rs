#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use sendmock_ops::{
    FetchedSetupFile, SetupFetchError, SetupFetchFuture, SetupFetchRequest, SetupFetcher,
};
use serde_json::{Value, json};
use support::test_app::{build_test_app, build_test_app_with, call_api};
use tower::ServiceExt;

const TWO_NUMBERS_SETUP: &str = "[settings]\nsms_failure_rate_percent = 5\n\n[[numbers]]\nnumber = \"+15550001111\"\nlabel = \"Support line\"\n\n[[numbers]]\nnumber = \"+15550002222\"\nlabel = \"Sales line\"\n";
const ONE_NUMBER_SETUP: &str = "[[numbers]]\nnumber = \"+15550003333\"\nlabel = \"New line\"\n";
const PASSPHRASE: &str = "correct horse battery";

/// Answers every download with `ONE_NUMBER_SETUP`, from a URL that names it TOML.
struct FixedSetupFetcher;

impl SetupFetcher for FixedSetupFetcher {
    fn fetch_setup<'fetcher>(
        &'fetcher self,
        _fetch_request: &'fetcher SetupFetchRequest,
    ) -> SetupFetchFuture<'fetcher> {
        Box::pin(async {
            Ok::<_, SetupFetchError>(FetchedSetupFile {
                bytes: ONE_NUMBER_SETUP.as_bytes().to_vec(),
                final_url: "https://example.com/team/setup.toml".to_owned(),
                content_type: Some("text/plain".to_owned()),
            })
        })
    }
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

async fn export_setup(app_router: &axum::Router, export_body: &Value) -> String {
    let request = Request::builder()
        .method("POST")
        .uri("/api/v1/setup/export")
        .header("content-type", "application/json")
        .body(Body::from(export_body.to_string()))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    assert_eq!(response.status().as_u16(), 200);
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    String::from_utf8_lossy(&body_bytes).into_owned()
}

async fn list_numbers(app_router: &axum::Router) -> Vec<String> {
    let (_, numbers) = call_api(app_router, "GET", "/api/v1/numbers", None).await;
    numbers
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|number| number["number"].as_str().map(str::to_owned))
        .collect()
}

/// Drops the header's `exported_at`, which two exports at different times differ in.
fn without_export_time(setup_text: &str) -> String {
    setup_text
        .lines()
        .filter(|line| {
            !line
                .trim_start()
                .trim_start_matches('"')
                .starts_with("exported_at")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

async fn build_seeded_app() -> axum::Router {
    let (app_router, _) = build_test_app();
    let (status, answer) =
        import_setup(&app_router, &json!({ "setup_text": TWO_NUMBERS_SETUP })).await;
    assert_eq!(status, 200, "{answer}");
    app_router
}

// AC: PL-18.1
#[tokio::test]
async fn an_export_imported_into_a_fresh_instance_exports_the_same_in_every_format() {
    let source_router = build_seeded_app().await;

    for format_name in ["toml", "json", "yaml"] {
        let exported_setup = export_setup(&source_router, &json!({ "format": format_name })).await;
        let (target_router, _) = build_test_app();

        let (status, answer) = import_setup(
            &target_router,
            &json!({ "setup_text": exported_setup.clone() }),
        )
        .await;

        assert_eq!(status, 200, "{format_name}: {answer}");
        let exported_again = export_setup(&target_router, &json!({ "format": format_name })).await;
        assert_eq!(
            without_export_time(&exported_again),
            without_export_time(&exported_setup)
        );
    }
}

// AC: PL-18.8
#[tokio::test]
async fn merge_keeps_what_the_file_does_not_hold() {
    let app_router = build_seeded_app().await;

    let (status, answer) =
        import_setup(&app_router, &json!({ "setup_text": ONE_NUMBER_SETUP })).await;

    assert_eq!(status, 200, "{answer}");
    assert_eq!(list_numbers(&app_router).await.len(), 3);
    assert_eq!(answer["changes"][0]["added"], json!(["+15550003333"]));
}

// AC: PL-18.8
#[tokio::test]
async fn replace_needs_the_removed_count_and_then_removes_the_rest() {
    let app_router = build_seeded_app().await;
    let replace_body = |confirm_removed_count: Option<u64>| {
        json!({
            "setup_text": ONE_NUMBER_SETUP,
            "mode": "replace",
            "confirm_removed_count": confirm_removed_count,
        })
    };

    let (unconfirmed_status, unconfirmed) = import_setup(&app_router, &replace_body(None)).await;
    let (wrong_status, _) = import_setup(&app_router, &replace_body(Some(1))).await;
    let numbers_before = list_numbers(&app_router).await;
    let (status, answer) = import_setup(&app_router, &replace_body(Some(2))).await;

    assert_eq!(unconfirmed_status, 422, "{unconfirmed}");
    assert_eq!(unconfirmed["error"]["code"], "setup_replace_unconfirmed");
    let message = unconfirmed["error"]["message"].as_str().unwrap_or_default();
    assert!(message.contains("removes 2 items"), "{message}");
    assert_eq!(wrong_status, 422);
    assert_eq!(
        numbers_before.len(),
        2,
        "nothing applied before the confirmation"
    );
    assert_eq!(status, 200, "{answer}");
    assert_eq!(list_numbers(&app_router).await, ["+15550003333"]);
    let (_, settings) = call_api(&app_router, "GET", "/api/v1/settings", None).await;
    assert_eq!(
        settings["sms_failure_rate_percent"], 0,
        "settings back to defaults"
    );
}

// AC: PL-18.8
#[tokio::test]
async fn an_invalid_file_applies_nothing() {
    let (app_router, _) = build_test_app();

    let (status, answer) = import_setup(
        &app_router,
        &json!({ "setup_text": "[[numbers]]\nnumber = \"+15550001111\"\n\n[[mystery]]\nkey = 1\n" }),
    )
    .await;

    assert_eq!(status, 422, "{answer}");
    assert!(list_numbers(&app_router).await.is_empty());
}

// AC: PL-18.7
#[tokio::test]
async fn imports_from_a_url_through_the_downloader() {
    let (app_router, operation_context) = build_test_app_with(|operation_context| {
        operation_context.with_setup_fetcher(Arc::new(FixedSetupFetcher))
    });

    let (status, answer) = import_setup(
        &app_router,
        &json!({
            "url": "https://example.com/team/setup.toml?token=abc",
            "headers": ["Authorization: Bearer abc123"],
        }),
    )
    .await;
    let (both_status, _) = import_setup(
        &app_router,
        &json!({ "url": "https://example.com/setup.toml", "setup_text": ONE_NUMBER_SETUP }),
    )
    .await;

    assert_eq!(status, 200, "{answer}");
    assert_eq!(list_numbers(&app_router).await, ["+15550003333"]);
    assert_eq!(both_status, 400);
    let seed_state = operation_context
        .setup_stores
        .seed_state
        .find_state()
        .await
        .unwrap_or_else(|error| panic!("the seed state: {error}"))
        .unwrap_or_else(|| panic!("a seed state"));
    assert_eq!(
        seed_state.source_path.as_deref(),
        Some("https://example.com/team/setup.toml")
    );
}

// AC: PL-18.6
#[tokio::test]
async fn encrypted_secrets_import_through_rest_with_the_passphrase() {
    let (source_router, _) = build_test_app();
    let endpoint_setup =
        "[[webhook.endpoints]]\nname = \"Billing\"\nurl = \"http://localhost:8000/hook\"\n";
    let (seed_status, seed_answer) =
        import_setup(&source_router, &json!({ "setup_text": endpoint_setup })).await;
    assert_eq!(seed_status, 200, "{seed_answer}");
    let encrypted_setup = export_setup(
        &source_router,
        &json!({ "include_secrets": true, "passphrase": PASSPHRASE }),
    )
    .await;
    let (target_router, _) = build_test_app();

    let (missing_status, missing) = import_setup(
        &target_router,
        &json!({ "setup_text": encrypted_setup.clone() }),
    )
    .await;
    let (status, answer) = import_setup(
        &target_router,
        &json!({ "setup_text": encrypted_setup, "passphrase": PASSPHRASE }),
    )
    .await;

    assert_eq!(missing_status, 422, "{missing}");
    assert_eq!(missing["error"]["code"], "setup_passphrase_required");
    assert_eq!(status, 200, "{answer}");
    assert_eq!(answer["has_encrypted_secrets"], true);
}
