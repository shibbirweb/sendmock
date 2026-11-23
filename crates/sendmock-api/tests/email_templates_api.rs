#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

const TEMPLATES_PATH: &str = "/api/v1/emails/templates";

fn welcome_template() -> Value {
    json!({
        "id": "welcome-email",
        "subject": "Welcome, {{ first_name }}",
        "text": "Hi {{ first_name }}",
        "html": null,
    })
}

// AC: EM-26.2
#[tokio::test]
async fn a_template_is_listed_created_changed_and_deleted() {
    let (app_router, _) = build_test_app();

    let (create_status, created) = call_api(
        &app_router,
        "POST",
        TEMPLATES_PATH,
        Some(&welcome_template()),
    )
    .await;
    let (duplicate_status, _) = call_api(
        &app_router,
        "POST",
        TEMPLATES_PATH,
        Some(&welcome_template()),
    )
    .await;
    let template_path = format!("{TEMPLATES_PATH}/welcome-email");
    let (update_status, updated) = call_api(
        &app_router,
        "PATCH",
        &template_path,
        Some(&json!({ "subject": "Hello" })),
    )
    .await;
    let (_, listed) = call_api(&app_router, "GET", TEMPLATES_PATH, None).await;
    let (delete_status, _) = call_api(&app_router, "DELETE", &template_path, None).await;
    let (_, listed_after) = call_api(&app_router, "GET", TEMPLATES_PATH, None).await;

    assert_eq!(create_status, 201, "{created}");
    assert_eq!(duplicate_status, 409);
    assert_eq!(update_status, 200, "{updated}");
    assert_eq!(updated["subject"], "Hello");
    assert_eq!(updated["text"], "Hi {{ first_name }}");
    assert_eq!(listed.as_array().map(Vec::len), Some(1));
    assert_eq!(delete_status, 204);
    assert_eq!(listed_after, json!([]));
}

// AC: EM-26.2
#[tokio::test]
async fn a_template_without_a_body_is_refused() {
    let (app_router, _) = build_test_app();

    let (status, refusal) = call_api(
        &app_router,
        "POST",
        TEMPLATES_PATH,
        Some(&json!({ "id": "empty", "subject": "Hi", "text": null, "html": null })),
    )
    .await;

    assert_eq!(status, 400, "{refusal}");
}

async fn get_mailgun_template(app_router: &axum::Router, template_name: &str) -> (u16, Value) {
    let request = Request::builder()
        .method("GET")
        .uri(format!(
            "/providers/mailgun/v3/mg.shop.test/templates/{template_name}?active=yes"
        ))
        .body(Body::empty())
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    (
        status,
        serde_json::from_slice(&body_bytes).unwrap_or(Value::Null),
    )
}

// AC: EM-26.3
#[tokio::test]
async fn mailguns_template_api_answers_from_the_local_templates() {
    let (app_router, _) = build_test_app();
    call_api(
        &app_router,
        "POST",
        TEMPLATES_PATH,
        Some(&welcome_template()),
    )
    .await;

    let (found_status, found) = get_mailgun_template(&app_router, "welcome-email").await;
    let (missing_status, missing) = get_mailgun_template(&app_router, "no-such-template").await;

    assert_eq!(found_status, 200, "{found}");
    assert_eq!(found["template"]["name"], "welcome-email");
    assert_eq!(found["template"]["version"]["active"], true);
    assert_eq!(
        found["template"]["version"]["headers"]["Subject"],
        "Welcome, {{ first_name }}"
    );
    assert_eq!(missing_status, 404, "{missing}");
    assert_eq!(missing["message"], "template not found");
}

// AC: EM-26.4
#[tokio::test]
async fn an_unknown_email_template_key_is_refused_by_validate_and_import_by_name() {
    let (app_router, _) = build_test_app();
    let setup_text = "[[email.templates]]\ntemplate_id = \"welcome-email\"\ntext = \"Hi\"\n";

    let (_, validation) = call_api(
        &app_router,
        "POST",
        "/api/v1/setup/validate",
        Some(&json!({ "setup_text": setup_text })),
    )
    .await;
    let (import_status, import_refusal) = call_api(
        &app_router,
        "POST",
        "/api/v1/setup/import",
        Some(&json!({ "setup_text": setup_text })),
    )
    .await;

    assert_eq!(validation["is_valid"], false, "{validation}");
    assert!(
        validation["errors"].to_string().contains("template_id"),
        "{validation}"
    );
    assert_eq!(import_status, 422, "{import_refusal}");
    assert!(
        import_refusal.to_string().contains("template_id"),
        "{import_refusal}"
    );
}
