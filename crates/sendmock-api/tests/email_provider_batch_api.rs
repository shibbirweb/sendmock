#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod email_provider_requests;
    pub mod test_app;
}

use serde_json::json;
use support::email_provider_requests::{count_emails, read_newest_email, send_json};
use support::test_app::build_test_app;

// AC: EM-08.1 EM-08.2
#[tokio::test]
async fn a_postmark_batch_answers_each_message_and_stores_only_the_valid_ones() {
    let (app_router, _) = build_test_app();
    let batch = json!([
        {"From": "shop@example.test", "To": "sam@example.test", "Subject": "One", "TextBody": "1"},
        {"To": "ops@example.test", "Subject": "Two", "TextBody": "2"},
    ]);

    let reply = send_json(&app_router, "/providers/postmark/email/batch", &batch).await;

    assert_eq!(reply.status, 200, "{}", reply.body_text);
    assert_eq!(reply.body[0]["ErrorCode"], 0);
    assert_eq!(reply.body[0]["To"], "sam@example.test");
    assert_eq!(reply.body[1]["ErrorCode"], 300);
    assert_eq!(count_emails(&app_router).await, 1);
}

// AC: EM-08.1 EM-08.2
#[tokio::test]
async fn a_resend_batch_answers_its_ids_under_data() {
    let (app_router, _) = build_test_app();
    let batch = json!([
        {"from": "shop@example.test", "to": ["sam@example.test"], "subject": "One", "text": "1"},
        {"from": "shop@example.test", "to": ["ops@example.test"], "subject": "Two", "html": "<p>2</p>"},
    ]);

    let reply = send_json(&app_router, "/providers/resend/emails/batch", &batch).await;

    assert_eq!(reply.status, 200, "{}", reply.body_text);
    let answered_ids = reply.body["data"].as_array().cloned().unwrap_or_default();
    assert_eq!(answered_ids.len(), 2);
    assert_ne!(answered_ids[0]["id"], answered_ids[1]["id"]);
    assert_eq!(count_emails(&app_router).await, 2);
}

// AC: EM-08.4
#[tokio::test]
async fn a_sendgrid_dynamic_template_send_keeps_its_template_id_and_data() {
    let (app_router, _) = build_test_app();
    let template_send = json!({
        "personalizations": [{
            "to": [{"email": "sam@example.test"}],
            "dynamic_template_data": {"first_name": "Sam", "plan": "Pro"},
        }],
        "from": {"email": "shop@example.test"},
        "template_id": "d-4f1c2b9a7e6d",
    });

    let reply = send_json(
        &app_router,
        "/providers/sendgrid/v3/mail/send",
        &template_send,
    )
    .await;

    assert_eq!(reply.status, 202, "{}", reply.body_text);
    let email = read_newest_email(&app_router).await;
    assert_eq!(email["template"]["template_id"], "d-4f1c2b9a7e6d");
    assert_eq!(
        email["template"]["template_data"],
        json!({"first_name": "Sam", "plan": "Pro"})
    );
}

// AC: EM-08.4
#[tokio::test]
async fn a_postmark_template_send_keeps_its_template_model() {
    let (app_router, _) = build_test_app();
    let template_send = json!({
        "From": "shop@example.test",
        "To": "sam@example.test",
        "TemplateId": 4_102_337,
        "TemplateModel": {"product_name": "Mugs", "name": "Sam"},
    });

    let reply = send_json(
        &app_router,
        "/providers/postmark/email/withTemplate",
        &template_send,
    )
    .await;

    assert_eq!(reply.status, 200, "{}", reply.body_text);
    assert_eq!(reply.body["ErrorCode"], 0);
    let email = read_newest_email(&app_router).await;
    assert_eq!(email["template"]["template_id"], "4102337");
    assert_eq!(email["template"]["template_data"]["product_name"], "Mugs");
}

#[tokio::test]
async fn an_email_sent_without_a_template_has_no_template_data() {
    let (app_router, _) = build_test_app();
    let plain_send = json!({
        "from": "shop@example.test",
        "to": ["sam@example.test"],
        "subject": "Plain",
        "text": "No template here",
    });

    send_json(&app_router, "/providers/resend/emails", &plain_send).await;

    let email = read_newest_email(&app_router).await;
    assert!(email["template"].is_null());
}
