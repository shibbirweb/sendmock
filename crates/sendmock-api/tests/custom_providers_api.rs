#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod email_provider_requests;
    pub mod test_app;
}

use serde_json::{Value, json};
use support::email_provider_requests::{read_newest_email, send_json};
use support::test_app::{build_test_app, call_api};

const EMAIL_PROVIDERS_PATH: &str = "/api/v1/emails/providers";
const SMS_PROVIDERS_PATH: &str = "/api/v1/sms/providers";

/// A blank custom email provider mapped to read a simple JSON send.
async fn create_mapped_email_provider(app_router: &axum::Router) -> Value {
    let (status, created) = call_api(
        app_router,
        "POST",
        EMAIL_PROVIDERS_PATH,
        Some(&json!({ "name": "Acme Mail", "key": "acme_mail", "start_from": null })),
    )
    .await;
    assert_eq!(status, 201, "{created}");
    let mut changed = created.clone();
    changed["operations"] = json!([{ "kind": "send", "method": "POST", "path": "/acme/send", "request_format": "json" }]);
    changed["field_mapping"] = json!([
        { "part": "from", "source": "sender" },
        { "part": "to", "source": "recipients[*]" },
        { "part": "subject", "source": "title" },
        { "part": "text", "source": "content" },
    ]);
    let (update_status, updated) = call_api(
        app_router,
        "PATCH",
        &format!("{EMAIL_PROVIDERS_PATH}/acme_mail"),
        Some(&changed),
    )
    .await;
    assert_eq!(update_status, 200, "{updated}");
    updated
}

// AC: EM-18.5
#[tokio::test]
async fn a_custom_email_provider_answers_from_its_definition_and_goes_when_deleted() {
    let (app_router, _) = build_test_app();
    let provider = create_mapped_email_provider(&app_router).await;
    let acme_send = json!({
        "sender": "shop@example.test",
        "recipients": ["sam@example.test"],
        "title": "From a custom provider",
        "content": "Hello",
    });

    let reply = send_json(&app_router, "/providers/acme_mail/acme/send", &acme_send).await;

    assert_eq!(provider["is_builtin"], false);
    assert_eq!(reply.status, 200, "{}", reply.body_text);
    assert_eq!(reply.body["status"], "queued");
    let email = read_newest_email(&app_router).await;
    assert_eq!(email["source"], "acme_mail");
    assert_eq!(email["subject"], "From a custom provider");

    let (delete_status, _) = call_api(
        &app_router,
        "DELETE",
        &format!("{EMAIL_PROVIDERS_PATH}/acme_mail"),
        None,
    )
    .await;
    let after_delete = send_json(&app_router, "/providers/acme_mail/acme/send", &acme_send).await;
    assert_eq!(delete_status, 204);
    assert_eq!(after_delete.status, 404, "{}", after_delete.body_text);
}

// AC: EM-18.6
#[tokio::test]
async fn new_providers_need_a_free_valid_key_and_a_name() {
    let (app_router, _) = build_test_app();
    let create = |provider_input: Value| {
        let app_router = app_router.clone();
        async move {
            call_api(
                &app_router,
                "POST",
                EMAIL_PROVIDERS_PATH,
                Some(&provider_input),
            )
            .await
        }
    };

    let (taken_status, taken) =
        create(json!({ "name": "Again", "key": "sendgrid", "start_from": null })).await;
    let (bad_key_status, _) =
        create(json!({ "name": "Bad", "key": "Bad-Key", "start_from": null })).await;
    let (native_status, _) =
        create(json!({ "name": "Native", "key": "native", "start_from": null })).await;
    let (unnamed_status, _) =
        create(json!({ "name": " ", "key": "unnamed", "start_from": null })).await;

    assert_eq!(taken_status, 409, "{taken}");
    assert_eq!(taken["error"]["code"], "provider_exists");
    assert_eq!(bad_key_status, 400);
    assert_eq!(native_status, 400);
    assert_eq!(unnamed_status, 400);
}

// AC: SM-16.5
#[tokio::test]
async fn a_custom_sms_provider_copied_from_twilio_gets_its_own_host_and_keeps_its_messages() {
    let (app_router, _) = build_test_app();

    let (status, created) = call_api(
        &app_router,
        "POST",
        SMS_PROVIDERS_PATH,
        Some(&json!({ "name": "Twilio EU", "key": "twilio_eu", "start_from": "twilio" })),
    )
    .await;

    assert_eq!(status, 201, "{created}");
    assert_eq!(created["host"], "twilio_eu.example.test");
    assert_eq!(created["is_builtin"], false);
    let (_, providers) = call_api(&app_router, "GET", SMS_PROVIDERS_PATH, None).await;
    let provider_keys: Vec<&str> = providers
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|provider| provider["key"].as_str())
        .collect();
    assert!(provider_keys.contains(&"twilio_eu"), "{provider_keys:?}");
    assert!(provider_keys.contains(&"twilio"), "{provider_keys:?}");
}
