#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use support::webhook_samples::{endpoint_input, send_email};

const PREVIEW_PATH: &str = "/api/v1/webhooks/endpoints/preview";

fn merge_fields(mut target: Value, changed_fields: Value) -> Value {
    if let (Some(target_fields), Some(changed_entries)) =
        (target.as_object_mut(), changed_fields.as_object())
    {
        target_fields.extend(changed_entries.clone());
    }
    target
}

fn endpoint_with(changed_settings: Value) -> Value {
    merge_fields(endpoint_input("Orders app"), changed_settings)
}

async fn preview_request(app_router: &axum::Router, preview_body: Value) -> Value {
    let (status, preview_result) =
        call_api(app_router, "POST", PREVIEW_PATH, Some(&preview_body)).await;
    assert_eq!(status, 200, "{preview_result}");
    preview_result
}

async fn create_global_variable(
    app_router: &axum::Router,
    variable_name: &str,
    kind: &str,
    value: &str,
) {
    let (status, created_variable) = call_api(
        app_router,
        "POST",
        "/api/v1/webhooks/variables",
        Some(&json!({
            "name": variable_name, "kind": kind, "scope": "global", "endpoint_id": null,
            "value": value, "random_mode": null, "description": "",
        })),
    )
    .await;
    assert_eq!(status, 201, "{created_variable}");
}

fn typed_fields() -> Value {
    json!([
        { "name": "user.email", "value_type": "text", "value": "{{ data.to[0].address }}" },
        { "name": "user.age", "value_type": "number", "value": "{{ vars.age }}" },
        { "name": "is_test", "value_type": "boolean", "value": "true" },
        { "name": "meta", "value_type": "json", "value": "{\"env\": \"{{ vars.env }}\"}" },
    ])
}

// AC: WH-07.6
#[tokio::test]
async fn fields_mode_encodes_typed_nested_json() {
    let (app_router, _) = build_test_app();

    let preview_result = preview_request(
        &app_router,
        json!({
            "endpoint": endpoint_with(json!({ "body_mode": "fields", "body_fields": typed_fields() })),
            "variables": { "age": "42", "env": "local" },
        }),
    )
    .await;

    let sent_body: Value =
        serde_json::from_str(preview_result["body"].as_str().unwrap_or_default())
            .unwrap_or_default();
    assert_eq!(
        sent_body,
        json!({
            "user": { "email": "ann@example.com", "age": 42 },
            "is_test": true,
            "meta": { "env": "local" },
        })
    );
    assert_eq!(
        preview_result["headers"]["content-type"],
        "application/json"
    );
    assert_eq!(preview_result["rendered_against"], "Built-in sample");
    assert_eq!(preview_result["problems"], json!([]));
}

// AC: WH-07.6
#[tokio::test]
async fn fields_mode_encodes_a_form_body() {
    let (app_router, _) = build_test_app();
    let form_fields = json!([
        { "name": "subject", "value_type": "text", "value": "{{ data.subject }} & more" },
        { "name": "to", "value_type": "text", "value": "{{ data.to[0].address }}" },
    ]);

    let preview_result = preview_request(
        &app_router,
        json!({ "endpoint": endpoint_with(json!({
            "body_mode": "fields", "body_fields": form_fields, "fields_encoding": "form",
        })) }),
    )
    .await;

    assert_eq!(
        preview_result["body"],
        "subject=Your+Acme+sign-in+code+%26+more&to=ann%40example.com"
    );
    assert_eq!(
        preview_result["headers"]["content-type"],
        "application/x-www-form-urlencoded"
    );
}

// AC: WH-07.6
#[tokio::test]
async fn a_field_that_does_not_render_its_type_is_an_error() {
    let (app_router, _) = build_test_app();
    let number_field = json!([
        { "name": "count", "value_type": "number", "value": "{{ data.subject }}" },
    ]);

    let preview_result = preview_request(
        &app_router,
        json!({ "endpoint": endpoint_with(json!({ "body_mode": "fields", "body_fields": number_field })) }),
    )
    .await;

    assert_eq!(
        preview_result["problems"],
        json!([{
            "message": "count renders \"Your Acme sign-in code\", which is not a number",
            "severity": "error", "source": "field.0", "line": null, "column": null,
        }])
    );
}

// AC: WH-07.8
#[tokio::test]
async fn url_query_headers_and_a_raw_json_body_render_against_a_chosen_email() {
    let (app_router, _) = build_test_app();
    create_global_variable(&app_router, "tenant", "text", "acme").await;
    let email_id = send_email(&app_router, "ann@example.com", "Say \"hi\" & bye").await;
    let request_settings = json!({
        "url": "http://localhost:3000/{{ vars.tenant }}/hooks",
        "query_params": [{ "name": "subject", "value": "{{ data.subject }}" }],
        "headers": { "X-Tenant": "{{ vars.tenant }}" },
        "body_mode": "raw",
        "raw_body": "{\"subject\": \"{{ data.subject }}\", \"endpoint\": \"{{ endpoint.name }}\"}",
    });

    let preview_result = preview_request(
        &app_router,
        json!({ "endpoint": endpoint_with(request_settings), "email_id": email_id }),
    )
    .await;

    let sent_body: Value =
        serde_json::from_str(preview_result["body"].as_str().unwrap_or_default())
            .unwrap_or_default();
    assert_eq!(
        preview_result["url"],
        "http://localhost:3000/acme/hooks?subject=Say+%22hi%22+%26+bye"
    );
    assert_eq!(preview_result["method"], "POST");
    assert_eq!(preview_result["headers"]["x-tenant"], "acme");
    assert_eq!(
        sent_body,
        json!({ "subject": "Say \"hi\" & bye", "endpoint": "Orders app" })
    );
    assert_eq!(preview_result["rendered_against"], "Say \"hi\" & bye");
    assert_eq!(preview_result["event_type"], "email.received");
}

// AC: WH-07.5
#[tokio::test]
async fn an_undefined_value_is_an_error_in_strict_mode_and_a_warning_in_lenient_mode() {
    let (app_router, _) = build_test_app();
    let missing_header = |render_mode: &str| {
        json!({ "endpoint": endpoint_with(json!({
            "headers": { "X-Missing": "{{ vars.missing }}" }, "render_mode": render_mode,
        })) })
    };

    let strict_result = preview_request(&app_router, missing_header("strict")).await;
    let lenient_result = preview_request(&app_router, missing_header("lenient")).await;

    let strict_problem = &strict_result["problems"][0];
    let lenient_problem = &lenient_result["problems"][0];
    assert_eq!(strict_problem["severity"], "error");
    assert_eq!(strict_problem["source"], "header.0");
    assert!(
        strict_problem["message"]
            .as_str()
            .unwrap_or_default()
            .contains("vars.missing")
    );
    assert_eq!(lenient_problem["severity"], "warning");
    assert_eq!(
        lenient_problem["message"],
        "Undefined variable: vars.missing"
    );
    assert_eq!(lenient_result["headers"]["x-missing"], "");
}

// AC: WH-07.12
#[tokio::test]
async fn a_secret_variable_is_masked_in_the_preview() {
    let (app_router, _) = build_test_app();
    create_global_variable(&app_router, "api_token", "secret", "sk_live_51234").await;

    let preview_result = preview_request(
        &app_router,
        json!({ "endpoint": endpoint_with(json!({
            "headers": { "Authorization": "Bearer {{ vars.api_token }}" },
        })) }),
    )
    .await;

    assert_eq!(preview_result["headers"]["authorization"], "Bearer ••••••");
}

#[tokio::test]
async fn an_unknown_email_is_not_found() {
    let (app_router, _) = build_test_app();

    let (status, error_answer) = call_api(
        &app_router,
        "POST",
        PREVIEW_PATH,
        Some(&json!({ "endpoint": endpoint_with(json!({})), "email_id": "01JB7T9Q2R5W8X3Y6Z1A4B7C9D" })),
    )
    .await;

    assert_eq!(status, 404, "{error_answer}");
}
