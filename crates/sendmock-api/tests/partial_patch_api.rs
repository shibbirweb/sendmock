#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

fn number_input() -> Value {
    json!({
        "number": "+15550001111",
        "label": "Support line",
        "channels": ["sms", "whatsapp"],
        "inbound_url": "http://localhost:3000/sms/inbound",
        "inbound_method": "POST",
        "inbound_fallback_url": null,
        "inbound_template_id": "twilio.inbound_sms",
        "status_callback_url": "https://app.test/sms/status",
        "messaging_service_sid": null,
    })
}

// AC: PL-26.4
#[tokio::test]
async fn a_provider_patch_with_one_field_keeps_the_rest_and_its_secrets() {
    let (app_router, _) = build_test_app();
    let provider_path = "/api/v1/emails/providers/mailgun";
    let (_, provider_before) = call_api(&app_router, "GET", provider_path, None).await;

    let (patch_status, patched_provider) = call_api(
        &app_router,
        "PATCH",
        provider_path,
        Some(&json!({ "is_enabled": false })),
    )
    .await;

    assert_eq!(patch_status, 200, "{patched_provider}");
    assert_eq!(patched_provider["is_enabled"], false);
    assert_eq!(patched_provider["key"], "mailgun");
    assert_eq!(patched_provider["name"], provider_before["name"]);
    assert_eq!(
        patched_provider["operations"],
        provider_before["operations"]
    );
    assert_eq!(
        patched_provider["credentials"],
        provider_before["credentials"]
    );
}

// AC: PL-26.4
#[tokio::test]
async fn a_number_patch_with_one_field_keeps_the_rest() {
    let (app_router, _) = build_test_app();
    let (_, created_number) = call_api(
        &app_router,
        "POST",
        "/api/v1/numbers",
        Some(&number_input()),
    )
    .await;
    let number_path = format!(
        "/api/v1/numbers/{}",
        created_number["id"].as_str().unwrap_or_default()
    );

    let (patch_status, patched_number) = call_api(
        &app_router,
        "PATCH",
        &number_path,
        Some(&json!({ "label": "Marketing" })),
    )
    .await;

    assert_eq!(patch_status, 200, "{patched_number}");
    assert_eq!(patched_number["label"], "Marketing");
    assert_eq!(patched_number["channels"], json!(["sms", "whatsapp"]));
    assert_eq!(
        patched_number["status_callback_url"],
        "https://app.test/sms/status"
    );
}

// AC: PL-26.4
#[tokio::test]
async fn a_field_of_the_wrong_type_in_a_partial_body_is_refused() {
    let (app_router, _) = build_test_app();

    let (patch_status, refusal) = call_api(
        &app_router,
        "PATCH",
        "/api/v1/emails/providers/mailgun",
        Some(&json!({ "is_enabled": "yes" })),
    )
    .await;

    assert_eq!(patch_status, 400, "{refusal}");
}

// AC: PL-26.5
#[tokio::test]
async fn an_unsaved_endpoint_preview_with_only_a_url_fills_every_other_field() {
    let (app_router, _) = build_test_app();

    let (preview_status, preview) = call_api(
        &app_router,
        "POST",
        "/api/v1/webhooks/endpoints/preview",
        Some(&json!({ "endpoint": { "url": "http://localhost:3000/hooks/mail" } })),
    )
    .await;

    assert_eq!(preview_status, 200, "{preview}");
    assert_eq!(preview["method"], "POST");
    assert_eq!(preview["url"], "http://localhost:3000/hooks/mail");
    assert!(
        preview["body"]
            .as_str()
            .is_some_and(|body| !body.is_empty()),
        "{preview}"
    );
}

// AC: PL-26.6
#[tokio::test]
async fn an_endpoint_made_from_a_name_url_and_template_takes_the_defaults_for_the_rest() {
    let (app_router, _) = build_test_app();

    let (create_status, created_endpoint) = call_api(
        &app_router,
        "POST",
        "/api/v1/webhooks/endpoints",
        Some(&json!({
            "name": "Laravel inbound mail",
            "url": "http://localhost:8000/mailgun/inbound",
            "template_id": "mailgun.routes",
        })),
    )
    .await;
    let (missing_url_status, missing_url_error) = call_api(
        &app_router,
        "POST",
        "/api/v1/webhooks/endpoints",
        Some(&json!({ "name": "No URL" })),
    )
    .await;

    assert_eq!(create_status, 201, "{created_endpoint}");
    assert_eq!(created_endpoint["template_id"], "mailgun.routes");
    assert_eq!(created_endpoint["method"], "POST");
    assert_eq!(created_endpoint["is_enabled"], true);
    assert_eq!(created_endpoint["headers"], json!({}));
    assert_eq!(created_endpoint["timeout_ms"], 10_000);
    assert_eq!(missing_url_status, 400, "{missing_url_error}");
}
