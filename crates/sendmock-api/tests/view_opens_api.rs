#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use support::webhook_samples::{create_endpoint, create_rule, send_email};

async fn open_count(app_router: &axum::Router, email_id: &str) -> Value {
    let (_, email) = call_api(
        app_router,
        "GET",
        &format!("/api/v1/emails/{email_id}"),
        None,
    )
    .await;
    email["open_count"].clone()
}

async fn record_open(app_router: &axum::Router, email_id: &str, source: &str) {
    let (status, answer) = call_api(
        app_router,
        "POST",
        &format!("/api/v1/emails/{email_id}/open"),
        Some(&json!({ "source": source })),
    )
    .await;
    assert_eq!(status, 204, "{answer}");
}

async fn build_app_with_opened_rule() -> axum::Router {
    let (app_router, _) = build_test_app();
    let endpoint_id = create_endpoint(&app_router, "Shop").await;
    create_rule(
        &app_router,
        &json!({
            "name": "Opens", "endpoint_id": endpoint_id, "events": ["email.opened"],
            "is_enabled": true,
        }),
    )
    .await;
    app_router
}

// AC: EM-27.2
#[tokio::test]
async fn a_view_a_webhook_rule_would_report_is_not_counted_but_a_manual_open_is() {
    let app_router = build_app_with_opened_rule().await;
    let email_id = send_email(&app_router, "sam@example.test", "Your order").await;

    record_open(&app_router, &email_id, "ui").await;
    let count_after_view = open_count(&app_router, &email_id).await;
    record_open(&app_router, &email_id, "manual").await;

    assert_eq!(count_after_view, 0);
    assert_eq!(open_count(&app_router, &email_id).await, 1);
}

// AC: EM-27.2
#[tokio::test]
async fn the_setting_counts_such_views_as_before() {
    let app_router = build_app_with_opened_rule().await;
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "count_views_with_webhook_rules": true })),
    )
    .await;
    let email_id = send_email(&app_router, "sam@example.test", "Your order").await;

    record_open(&app_router, &email_id, "ui").await;

    assert_eq!(open_count(&app_router, &email_id).await, 1);
}

// AC: EM-27.2
#[tokio::test]
async fn without_a_rule_a_view_still_counts() {
    let (app_router, _) = build_test_app();
    let email_id = send_email(&app_router, "sam@example.test", "Your order").await;

    record_open(&app_router, &email_id, "ui").await;

    assert_eq!(open_count(&app_router, &email_id).await, 1);
}
