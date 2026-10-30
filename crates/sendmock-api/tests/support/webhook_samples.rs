use serde_json::{Value, json};

use super::test_app::call_api;

/// An endpoint body with the defaults the edit sheet starts with.
pub fn endpoint_input(endpoint_name: &str) -> Value {
    json!({
        "name": endpoint_name, "url": "http://localhost:3000/hooks", "method": "POST",
        "headers": {}, "extra_fields": {}, "template_id": "native", "template_mode": "linked",
        "timeout_ms": 10_000,
        "retry_policy": {
            "max_attempts": 5, "backoff_seconds": [1, 5, 30, 120, 600],
            "retry_on_client_errors": false,
        },
        "is_enabled": true, "query_params": [], "body_mode": "template", "body_fields": [],
        "fields_encoding": "json", "raw_content_type": "application/json", "raw_body": "",
        "render_mode": "strict",
    })
}

/// Creates an endpoint and answers its id.
pub async fn create_endpoint(app_router: &axum::Router, endpoint_name: &str) -> String {
    let (status, created_endpoint) = call_api(
        app_router,
        "POST",
        "/api/v1/webhooks/endpoints",
        Some(&endpoint_input(endpoint_name)),
    )
    .await;
    assert_eq!(status, 201, "{created_endpoint}");
    created_endpoint["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

/// Creates a rule and answers it.
pub async fn create_rule(app_router: &axum::Router, rule_input: &Value) -> Value {
    let (status, created_rule) = call_api(
        app_router,
        "POST",
        "/api/v1/webhooks/rules",
        Some(rule_input),
    )
    .await;
    assert_eq!(status, 201, "{created_rule}");
    created_rule
}

/// Sends an email through the native API and answers its id.
pub async fn send_email(app_router: &axum::Router, recipient: &str, subject: &str) -> String {
    let (status, sent_email) = call_api(
        app_router,
        "POST",
        "/api/v1/send",
        Some(&json!({
            "from": "Shop <no-reply@shop.test>", "to": [recipient], "subject": subject,
            "text": "Hello", "headers": { "X-Tenant": "acme" },
        })),
    )
    .await;
    assert!(status == 200 || status == 201, "{status} {sent_email}");
    sent_email["id"].as_str().unwrap_or_default().to_owned()
}
