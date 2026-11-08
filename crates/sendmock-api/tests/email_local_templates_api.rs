#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod email_provider_requests;
    pub mod test_app;
}

use serde_json::{Value, json};
use support::email_provider_requests::{read_newest_email, send_json};
use support::test_app::{build_test_app, call_api, call_api_text};

const WELCOME_TEMPLATE_SEED: &str = r#"
[[email.templates]]
id = "d-welcome"
subject = "Welcome, {{ first_name }}"
text = "Hi {{ first_name }}, your {{ plan }} plan is ready."
html = "<p>Hi {{ first_name }}, your <b>{{ plan }}</b> plan is ready.</p>"
"#;

async fn apply_seed(app_router: &axum::Router, seed_toml: &str) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        "/api/v1/seed/apply",
        Some(&json!({ "seed_toml": seed_toml })),
    )
    .await
}

fn sendgrid_template_send(template_id: &str) -> Value {
    json!({
        "personalizations": [{
            "to": [{"email": "sam@example.test"}],
            "dynamic_template_data": {"first_name": "Sam", "plan": "Pro"},
        }],
        "from": {"email": "shop@example.test"},
        "template_id": template_id,
    })
}

// AC: EM-08.4
#[tokio::test]
async fn a_template_send_is_rendered_from_the_local_template_with_its_data() {
    let (app_router, _) = build_test_app();
    let (apply_status, applied) = apply_seed(&app_router, WELCOME_TEMPLATE_SEED).await;
    assert_eq!(apply_status, 200, "{applied}");

    let reply = send_json(
        &app_router,
        "/providers/sendgrid/v3/mail/send",
        &sendgrid_template_send("d-welcome"),
    )
    .await;

    assert_eq!(reply.status, 202, "{}", reply.body_text);
    let email = read_newest_email(&app_router).await;
    assert_eq!(email["subject"], "Welcome, Sam");
    assert!(
        email["text_body"]
            .as_str()
            .is_some_and(|text_body| text_body.contains("Hi Sam, your Pro plan is ready."))
    );
    assert!(
        email["html_body"]
            .as_str()
            .is_some_and(|html_body| html_body.contains("your <b>Pro</b> plan"))
    );
    assert_eq!(email["template"]["template_id"], "d-welcome");
}

// AC: EM-08.4
#[tokio::test]
async fn a_template_send_without_a_local_template_keeps_only_its_data() {
    let (app_router, _) = build_test_app();
    apply_seed(&app_router, WELCOME_TEMPLATE_SEED).await;

    send_json(
        &app_router,
        "/providers/sendgrid/v3/mail/send",
        &sendgrid_template_send("d-unknown"),
    )
    .await;

    let email = read_newest_email(&app_router).await;
    assert_eq!(email["subject"], "");
    assert_eq!(email["template"]["template_data"]["first_name"], "Sam");
}

#[tokio::test]
async fn local_templates_are_exported_and_a_template_without_a_body_is_refused() {
    let (app_router, _) = build_test_app();
    apply_seed(&app_router, WELCOME_TEMPLATE_SEED).await;
    let (refused_status, refused) = apply_seed(
        &app_router,
        "[[email.templates]]\nid = \"d-empty\"\nsubject = \"No body\"\n",
    )
    .await;

    let (_, _, exported_seed) = call_api_text(&app_router, "/api/v1/seed/export").await;

    assert!(
        exported_seed.contains("[[email.templates]]"),
        "{exported_seed}"
    );
    assert!(
        exported_seed.contains("id = \"d-welcome\""),
        "{exported_seed}"
    );
    assert_eq!(refused_status, 422, "{refused}");
}
