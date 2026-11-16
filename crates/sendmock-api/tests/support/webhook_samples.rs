use std::time::Duration;

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

/// How long a test waits for a background task to queue deliveries; a slow CI runner can take
/// a few seconds, and a passing test stops waiting as soon as they are there.
const DELIVERY_WAIT_TIMEOUT: Duration = Duration::from_secs(10);
const DELIVERY_POLL_INTERVAL: Duration = Duration::from_millis(10);

/// Waits for `delivery_count` queued deliveries, since rules fire from a background subscriber,
/// and answers the deliveries found by then.
pub async fn wait_for_deliveries(app_router: &axum::Router, delivery_count: usize) -> Vec<Value> {
    wait_for_deliveries_at(app_router, "/api/v1/webhooks/deliveries", delivery_count).await
}

/// Waits for `delivery_count` deliveries in the list at `deliveries_path` (which may filter it)
/// and answers the deliveries found by then.
pub async fn wait_for_deliveries_at(
    app_router: &axum::Router,
    deliveries_path: &str,
    delivery_count: usize,
) -> Vec<Value> {
    let wait_deadline = tokio::time::Instant::now() + DELIVERY_WAIT_TIMEOUT;
    loop {
        let (_, page) = call_api(app_router, "GET", deliveries_path, None).await;
        let deliveries = page["items"].as_array().cloned().unwrap_or_default();
        if deliveries.len() >= delivery_count || tokio::time::Instant::now() >= wait_deadline {
            return deliveries;
        }
        tokio::time::sleep(DELIVERY_POLL_INTERVAL).await;
    }
}
