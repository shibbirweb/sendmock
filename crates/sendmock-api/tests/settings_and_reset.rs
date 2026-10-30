#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::json;
use support::test_app::{build_test_app, call_api};

fn native_email(text: &str) -> serde_json::Value {
    json!({ "from": "app@shop.test", "to": ["sam@example.test"], "subject": "Hello", "text": text })
}

#[tokio::test]
async fn a_changed_setting_is_saved_and_returned() {
    let (app_router, _) = build_test_app();

    let (patch_status, patched) = call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "max_emails": 250, "max_age_days": 7 })),
    )
    .await;
    let (_, read_back) = call_api(&app_router, "GET", "/api/v1/settings", None).await;

    assert_eq!(patch_status, 200);
    assert_eq!(patched["max_emails"], 250);
    assert_eq!(read_back["max_emails"], 250);
    assert_eq!(read_back["max_age_days"], 7);
    assert_eq!(read_back["max_sms"], 1000);
}

#[tokio::test]
async fn new_otp_patterns_apply_to_the_next_email_without_a_restart() {
    let (app_router, _) = build_test_app();
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "otp_patterns": ["PIN-(\\d{4})"] })),
    )
    .await;

    call_api(
        &app_router,
        "POST",
        "/api/v1/send",
        Some(&native_email("Your PIN-4321 expires soon")),
    )
    .await;
    let (otp_status, extracted) =
        call_api(&app_router, "GET", "/api/v1/otp?to=sam@example.test", None).await;

    assert_eq!(otp_status, 200);
    assert_eq!(extracted["code"], "4321");
}

#[tokio::test]
async fn an_invalid_value_is_refused_with_its_field() {
    let (app_router, _) = build_test_app();

    let (status, error_body) = call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "sms_failure_rate_percent": 150 })),
    )
    .await;

    assert_eq!(status, 400);
    assert_eq!(error_body["error"]["field"], "sms_failure_rate_percent");
}

#[tokio::test]
async fn the_relay_password_is_masked_and_kept_when_sent_back_masked() {
    let (app_router, operation_context) = build_test_app();
    let relay_url = "smtp://mailer:s3cret@relay.test:587";

    let (_, saved) = call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "relay_smtp_url": relay_url })),
    )
    .await;
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "relay_smtp_url": saved["relay_smtp_url"] })),
    )
    .await;
    let stored_settings = operation_context
        .settings_store
        .current()
        .await
        .unwrap_or_else(|error| panic!("settings: {error}"));

    assert_eq!(
        saved["relay_smtp_url"],
        "smtp://mailer:********@relay.test:587"
    );
    assert_eq!(stored_settings.relay_smtp_url.as_deref(), Some(relay_url));
}

// AC: PL-08.1
#[tokio::test]
async fn pruning_keeps_the_newest_emails_up_to_the_limit() {
    let (app_router, operation_context) = build_test_app();
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "max_emails": 2 })),
    )
    .await;
    for email_number in 1..=3 {
        call_api(
            &app_router,
            "POST",
            "/api/v1/send",
            Some(&native_email(&format!("email {email_number}"))),
        )
        .await;
    }

    sendmock_ops::prune_traffic(&operation_context)
        .await
        .unwrap_or_else(|error| panic!("pruning: {error}"));
    let (_, email_page) = call_api(&app_router, "GET", "/api/v1/emails", None).await;
    let (_, settings) = call_api(&app_router, "GET", "/api/v1/settings", None).await;

    assert_eq!(email_page["total_count"], 2);
    assert_eq!(settings["max_emails"], 2);
}

#[tokio::test]
async fn reset_deletes_traffic_and_restores_the_default_settings() {
    let (app_router, _) = build_test_app();
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "max_emails": 10 })),
    )
    .await;
    call_api(
        &app_router,
        "POST",
        "/api/v1/send",
        Some(&native_email("hello")),
    )
    .await;

    let (reset_status, _) = call_api(&app_router, "POST", "/api/v1/reset", None).await;
    let (_, email_page) = call_api(&app_router, "GET", "/api/v1/emails", None).await;
    let (_, request_page) = call_api(&app_router, "GET", "/api/v1/logs/http", None).await;
    let (_, settings) = call_api(&app_router, "GET", "/api/v1/settings", None).await;

    assert_eq!(reset_status, 204);
    assert_eq!(email_page["total_count"], 0);
    assert_eq!(request_page["total_count"], 0);
    assert_eq!(settings["max_emails"], 1000);
}
