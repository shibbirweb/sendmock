#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const ENDPOINTS_PATH: &str = "/api/v1/webhooks/endpoints";

fn endpoint_input(endpoint_name: &str) -> Value {
    json!({
        "name": endpoint_name,
        "url": "http://localhost:3000/webhooks/sendmock",
        "method": "POST",
        "headers": {},
        "extra_fields": {},
        "template_id": "native",
        "template_mode": "linked",
        "timeout_ms": 10_000,
        "retry_policy": {
            "max_attempts": 5,
            "backoff_seconds": [1, 5, 30, 120, 600],
            "retry_on_client_errors": false,
        },
        "is_enabled": true,
        "query_params": [],
        "body_mode": "template",
        "body_fields": [],
        "fields_encoding": "json",
        "raw_content_type": "application/json",
        "raw_body": "",
        "render_mode": "strict",
    })
}

async fn create_endpoint(app_router: &axum::Router, endpoint_name: &str) -> (Value, String) {
    let (status, created_endpoint) = call_api(
        app_router,
        "POST",
        ENDPOINTS_PATH,
        Some(&endpoint_input(endpoint_name)),
    )
    .await;
    assert_eq!(status, 201, "{created_endpoint}");
    let endpoint_path = format!(
        "{ENDPOINTS_PATH}/{}",
        created_endpoint["id"].as_str().unwrap_or_default()
    );
    (created_endpoint, endpoint_path)
}

// AC: WH-01.1
#[tokio::test]
async fn endpoints_are_created_edited_switched_off_and_deleted() {
    let (app_router, _) = build_test_app();
    let (created_endpoint, endpoint_path) = create_endpoint(&app_router, "Orders app").await;
    create_endpoint(&app_router, "Billing").await;

    let (patch_status, edited_endpoint) = call_api(
        &app_router,
        "PATCH",
        &endpoint_path,
        Some(
            &json!({ "is_enabled": false, "timeout_ms": 5_000, "headers": { "X-Team": "orders" } }),
        ),
    )
    .await;
    let (delete_status, _) = call_api(&app_router, "DELETE", &endpoint_path, None).await;
    let (_, remaining_endpoints) = call_api(&app_router, "GET", ENDPOINTS_PATH, None).await;

    assert_eq!(created_endpoint["created_by"], "api");
    assert_eq!(created_endpoint["success_rate"], Value::Null);
    assert_eq!(
        created_endpoint["success_history"].as_array().map(Vec::len),
        Some(24)
    );
    assert_eq!(patch_status, 200);
    assert_eq!(edited_endpoint["is_enabled"], false);
    assert_eq!(edited_endpoint["timeout_ms"], 5_000);
    assert_eq!(edited_endpoint["headers"], json!({ "X-Team": "orders" }));
    assert_eq!(edited_endpoint["name"], "Orders app");
    assert_eq!(edited_endpoint["retry_policy"]["max_attempts"], 5);
    assert_eq!(delete_status, 204);
    assert_eq!(
        remaining_endpoints.as_array().map(|endpoints| endpoints
            .iter()
            .map(|endpoint| endpoint["name"].clone())
            .collect()),
        Some(vec![json!("Billing")])
    );
}

// AC: WH-01.3
#[tokio::test]
async fn the_secret_is_masked_everywhere_but_the_reveal() {
    let (app_router, _) = build_test_app();
    let (created_endpoint, endpoint_path) = create_endpoint(&app_router, "Orders app").await;

    let (_, shown_endpoint) = call_api(&app_router, "GET", &endpoint_path, None).await;
    let (_, listed_endpoints) = call_api(&app_router, "GET", ENDPOINTS_PATH, None).await;
    let (reveal_status, revealed) =
        call_api(&app_router, "GET", &format!("{endpoint_path}/secret"), None).await;

    let secret = revealed["secret"].as_str().unwrap_or_default();
    let masked_secret = created_endpoint["masked_secret"]
        .as_str()
        .unwrap_or_default();
    assert_eq!(reveal_status, 200);
    assert!(secret.starts_with("whsec_"), "{secret}");
    assert!(masked_secret.starts_with("whsec_••••"), "{masked_secret}");
    assert!(secret.ends_with(masked_secret.trim_start_matches("whsec_••••")));
    for answer in [&created_endpoint, &shown_endpoint, &listed_endpoints] {
        assert!(!answer.to_string().contains(secret), "{answer}");
    }
}

// AC: WH-01.5
#[tokio::test]
async fn invalid_settings_are_refused_with_the_field_that_is_wrong() {
    let (app_router, _) = build_test_app();
    let invalid_changes = [
        (json!({ "name": "  " }), "name"),
        (json!({ "url": "ftp://example.com" }), "url"),
        (json!({ "timeout_ms": 500 }), "timeout_ms"),
        (json!({ "timeout_ms": 61_000 }), "timeout_ms"),
        (
            json!({ "retry_policy": { "max_attempts": 11, "backoff_seconds": [1], "retry_on_client_errors": false } }),
            "retry_policy",
        ),
        (
            json!({ "retry_policy": { "max_attempts": 3, "backoff_seconds": [0], "retry_on_client_errors": false } }),
            "backoff_seconds",
        ),
        (
            json!({ "retry_policy": { "max_attempts": 3, "backoff_seconds": [86_401], "retry_on_client_errors": false } }),
            "backoff_seconds",
        ),
        (
            json!({ "body_mode": "raw", "raw_content_type": "" }),
            "raw_content_type",
        ),
        (
            json!({ "body_mode": "fields", "body_fields": [{ "name": "count", "value_type": "number", "value": "many" }] }),
            "body_fields",
        ),
    ];

    for (invalid_change, wrong_field) in invalid_changes {
        let mut invalid_input = endpoint_input("Orders app");
        for (field_name, field_value) in invalid_change.as_object().into_iter().flatten() {
            invalid_input[field_name] = field_value.clone();
        }
        let (status, error_answer) =
            call_api(&app_router, "POST", ENDPOINTS_PATH, Some(&invalid_input)).await;

        assert_eq!(status, 400, "{invalid_change}");
        assert_eq!(
            error_answer["error"]["field"], wrong_field,
            "{error_answer}"
        );
    }
}

#[tokio::test]
async fn templated_urls_are_accepted() {
    let (app_router, _) = build_test_app();
    let mut templated_input = endpoint_input("Orders app");
    templated_input["url"] = json!("{{ vars.app_url }}/webhooks");

    let (status, created_endpoint) =
        call_api(&app_router, "POST", ENDPOINTS_PATH, Some(&templated_input)).await;

    assert_eq!(status, 201, "{created_endpoint}");
    assert_eq!(created_endpoint["url"], "{{ vars.app_url }}/webhooks");
}

// AC: WH-01.8
#[tokio::test]
async fn rotating_the_secret_shows_the_new_one_and_when_the_old_one_stops() {
    let (app_router, _) = build_test_app();
    let (created_endpoint, endpoint_path) = create_endpoint(&app_router, "Orders app").await;
    let rotate_path = format!("{endpoint_path}/rotate-secret");

    let (refused_status, _) = call_api(
        &app_router,
        "POST",
        &rotate_path,
        Some(&json!({ "overlap_hours": 5 })),
    )
    .await;
    let (rotate_status, rotated_endpoint) = call_api(
        &app_router,
        "POST",
        &rotate_path,
        Some(&json!({ "overlap_hours": 24 })),
    )
    .await;
    let (_, revealed) =
        call_api(&app_router, "GET", &format!("{endpoint_path}/secret"), None).await;

    assert_eq!(created_endpoint["previous_secret_expires_at"], Value::Null);
    assert_eq!(refused_status, 400);
    assert_eq!(rotate_status, 200);
    assert_ne!(
        rotated_endpoint["masked_secret"],
        created_endpoint["masked_secret"]
    );
    assert!(
        rotated_endpoint["previous_secret_expires_at"]
            .as_str()
            .is_some_and(|expires_at| expires_at.starts_with("2026-01-02T00:00:00")),
        "{rotated_endpoint}"
    );
    let new_secret = revealed["secret"].as_str().unwrap_or_default();
    let masked_secret = rotated_endpoint["masked_secret"]
        .as_str()
        .unwrap_or_default();
    assert!(new_secret.ends_with(masked_secret.trim_start_matches("whsec_••••")));
}

#[tokio::test]
async fn a_missing_endpoint_answers_404() {
    let (app_router, _) = build_test_app();
    let missing_path = format!("{ENDPOINTS_PATH}/01JB7T9Q2R5W8X3Y6Z1A4B7C9D");

    let (get_status, _) = call_api(&app_router, "GET", &missing_path, None).await;
    let (patch_status, _) = call_api(
        &app_router,
        "PATCH",
        &missing_path,
        Some(&json!({ "name": "x" })),
    )
    .await;
    let (delete_status, _) = call_api(&app_router, "DELETE", &missing_path, None).await;
    let (secret_status, _) =
        call_api(&app_router, "GET", &format!("{missing_path}/secret"), None).await;
    let (rotate_status, _) = call_api(
        &app_router,
        "POST",
        &format!("{missing_path}/rotate-secret"),
        Some(&json!({ "overlap_hours": 24 })),
    )
    .await;

    assert_eq!(
        [
            get_status,
            patch_status,
            delete_status,
            secret_status,
            rotate_status
        ],
        [404, 404, 404, 404, 404]
    );
}
