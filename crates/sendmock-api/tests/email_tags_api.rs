#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::json;
use support::test_app::{build_test_app, call_api};

// AC: EM-12.4
#[tokio::test]
async fn tags_are_replaced_trimmed_lowercased_and_cleared_through_the_api() {
    let (app_router, _) = build_test_app();
    let (_, sent) = call_api(
        &app_router,
        "POST",
        "/api/v1/send",
        Some(&json!({ "from": "app@shop.test", "to": ["sam@example.test"], "subject": "Tags", "text": "Hi" })),
    )
    .await;
    let email_path = format!("/api/v1/emails/{}", sent["id"].as_str().unwrap_or_default());

    let (_, tagged) = call_api(
        &app_router,
        "PATCH",
        &email_path,
        Some(&json!({ "tags": [" Signup ", "qa", ""] })),
    )
    .await;
    let (_, cleared) = call_api(
        &app_router,
        "PATCH",
        &email_path,
        Some(&json!({ "tags": [] })),
    )
    .await;

    assert_eq!(tagged["tags"], json!(["signup", "qa"]));
    assert_eq!(cleared["tags"], json!([]));
}
