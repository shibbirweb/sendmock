#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

async fn send_email(app_router: &axum::Router, recipient: &str, subject: &str) -> Value {
    let (status, created) = call_api(
        app_router,
        "POST",
        "/api/v1/send",
        Some(&json!({
            "from": "app@shop.test",
            "to": [recipient],
            "subject": subject,
            "text": "Hello",
        })),
    )
    .await;
    assert_eq!(status, 201, "{created}");
    created
}

async fn list_subjects(app_router: &axum::Router) -> Vec<String> {
    let (_, email_page) = call_api(app_router, "GET", "/api/v1/emails", None).await;
    let mut subjects: Vec<String> = email_page["items"]
        .as_array()
        .map(|emails| {
            emails
                .iter()
                .filter_map(|email| email["subject"].as_str().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default();
    subjects.sort();
    subjects
}

// AC: EM-03.5
#[tokio::test]
async fn one_email_is_deleted_by_its_id() {
    let (app_router, _) = build_test_app();
    let welcome = send_email(&app_router, "sam@example.test", "Welcome").await;
    send_email(&app_router, "sam@example.test", "Receipt").await;

    let welcome_path = format!(
        "/api/v1/emails/{}",
        welcome["id"].as_str().unwrap_or_default()
    );
    let (delete_status, _) = call_api(&app_router, "DELETE", &welcome_path, None).await;

    assert_eq!(delete_status, 204);
    assert_eq!(list_subjects(&app_router).await, ["Receipt"]);
}

// AC: EM-03.5
#[tokio::test]
async fn a_filtered_delete_removes_only_the_emails_the_list_shows_for_it() {
    let (app_router, _) = build_test_app();
    send_email(&app_router, "sam@example.test", "Welcome Sam").await;
    send_email(&app_router, "sam@example.test", "Receipt for Sam").await;
    send_email(&app_router, "lee@example.test", "Welcome Lee").await;

    let (by_recipient_status, _) = call_api(
        &app_router,
        "DELETE",
        "/api/v1/emails?to=sam@example.test",
        None,
    )
    .await;
    let after_recipient = list_subjects(&app_router).await;
    let (by_search_status, _) = call_api(
        &app_router,
        "DELETE",
        "/api/v1/emails?query=subject:Lee",
        None,
    )
    .await;

    assert_eq!(by_recipient_status, 204);
    assert_eq!(after_recipient, ["Welcome Lee"]);
    assert_eq!(by_search_status, 204);
    assert!(list_subjects(&app_router).await.is_empty());
}

// AC: EM-03.5
#[tokio::test]
async fn a_delete_without_filters_removes_every_email() {
    let (app_router, _) = build_test_app();
    send_email(&app_router, "sam@example.test", "Welcome").await;
    send_email(&app_router, "lee@example.test", "Hello").await;

    let (delete_status, _) = call_api(&app_router, "DELETE", "/api/v1/emails", None).await;

    assert_eq!(delete_status, 204);
    assert!(list_subjects(&app_router).await.is_empty());
}
