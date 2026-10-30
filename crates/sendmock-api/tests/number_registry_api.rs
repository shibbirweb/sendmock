#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

fn number_input(e164_number: &str) -> Value {
    json!({
        "number": e164_number,
        "label": "Support line",
        "channels": ["sms", "whatsapp"],
        "inbound_url": "http://localhost:3000/sms/inbound",
        "inbound_method": "POST",
        "inbound_fallback_url": null,
        "inbound_template_id": "twilio.inbound_sms",
        "status_callback_url": null,
        "messaging_service_sid": null,
    })
}

fn service_input(number_ids: &[&Value]) -> Value {
    json!({
        "friendly_name": "Notifications",
        "number_ids": number_ids,
        "inbound_mode": "defer_to_sender",
        "inbound_url": null,
        "inbound_fallback_url": null,
    })
}

async fn create(app_router: &axum::Router, path: &str, input: &Value) -> Value {
    let (status, created) = call_api(app_router, "POST", path, Some(input)).await;
    assert_eq!(status, 201, "{created}");
    created
}

fn text(value: &Value) -> &str {
    value.as_str().unwrap_or_default()
}

// AC: SM-12.1
#[tokio::test]
async fn a_number_is_created_edited_and_deleted() {
    let (app_router, _) = build_test_app();
    let created_number = create(
        &app_router,
        "/api/v1/numbers",
        &number_input("+15550001111"),
    )
    .await;
    let number_path = format!("/api/v1/numbers/{}", text(&created_number["id"]));
    let mut changed_input = number_input("+15550001111");
    changed_input["label"] = json!("Marketing");
    changed_input["channels"] = json!(["sms"]);
    changed_input["status_callback_url"] = json!("https://app.test/sms/status");

    let (patch_status, changed_number) =
        call_api(&app_router, "PATCH", &number_path, Some(&changed_input)).await;
    let (delete_status, _) = call_api(&app_router, "DELETE", &number_path, None).await;
    let (_, remaining_numbers) = call_api(&app_router, "GET", "/api/v1/numbers", None).await;

    assert_eq!(created_number["channels"], json!(["sms", "whatsapp"]));
    assert_eq!(created_number["inbound_template_id"], "twilio.inbound_sms");
    assert_eq!(created_number["created_by"], "api");
    assert_eq!(patch_status, 200);
    assert_eq!(changed_number["label"], "Marketing");
    assert_eq!(
        changed_number["status_callback_url"],
        "https://app.test/sms/status"
    );
    assert_eq!(delete_status, 204);
    assert_eq!(remaining_numbers, json!([]));
}

// AC: SM-12.3
#[tokio::test]
async fn invalid_numbers_are_refused_with_their_field() {
    let (app_router, _) = build_test_app();
    create(
        &app_router,
        "/api/v1/numbers",
        &number_input("+15550001111"),
    )
    .await;
    let mut without_channel = number_input("+15550002222");
    without_channel["channels"] = json!([]);
    let mut with_ftp_url = number_input("+15550003333");
    with_ftp_url["inbound_url"] = json!("ftp://app.test/inbound");

    let cases = [
        (
            number_input("5550001111"),
            "number",
            "Use E.164, for example +15550001111",
        ),
        (
            number_input("+15550001111"),
            "number",
            "This number is already registered",
        ),
        (without_channel, "channels", "Pick at least one channel"),
        (
            with_ftp_url,
            "inbound_url",
            "Enter an http:// or https:// URL",
        ),
    ];
    for (invalid_input, expected_field, expected_message) in cases {
        let (status, error_body) =
            call_api(&app_router, "POST", "/api/v1/numbers", Some(&invalid_input)).await;
        assert_eq!(status, 400);
        assert_eq!(error_body["error"]["field"], expected_field);
        assert_eq!(error_body["error"]["message"], expected_message);
    }
}

// AC: SM-03.4
#[tokio::test]
async fn a_number_moved_to_another_service_leaves_its_old_pool() {
    let (app_router, _) = build_test_app();
    let first_number = create(
        &app_router,
        "/api/v1/numbers",
        &number_input("+15550001111"),
    )
    .await;
    let second_number = create(
        &app_router,
        "/api/v1/numbers",
        &number_input("+15550002222"),
    )
    .await;
    let first_service = create(
        &app_router,
        "/api/v1/messaging-services",
        &service_input(&[&first_number["id"], &second_number["id"]]),
    )
    .await;
    let second_service = create(
        &app_router,
        "/api/v1/messaging-services",
        &service_input(&[]),
    )
    .await;
    let mut moved_input = number_input("+15550002222");
    moved_input["messaging_service_sid"] = second_service["sid"].clone();

    call_api(
        &app_router,
        "PATCH",
        &format!("/api/v1/numbers/{}", text(&second_number["id"])),
        Some(&moved_input),
    )
    .await;
    let (_, services) = call_api(&app_router, "GET", "/api/v1/messaging-services", None).await;

    assert!(text(&first_service["sid"]).starts_with("MG"));
    assert_eq!(text(&first_service["sid"]).len(), 34);
    assert_eq!(
        first_service["number_ids"],
        json!([first_number["id"], second_number["id"]])
    );
    assert_eq!(services[0]["number_ids"], json!([first_number["id"]]));
    assert_eq!(services[1]["number_ids"], json!([second_number["id"]]));
}

// AC: SM-03.4
#[tokio::test]
async fn a_service_sets_its_inbound_handling_and_frees_its_numbers_on_delete() {
    let (app_router, _) = build_test_app();
    let pooled_number = create(
        &app_router,
        "/api/v1/numbers",
        &number_input("+15550001111"),
    )
    .await;
    let mut webhook_without_url = service_input(&[&pooled_number["id"]]);
    webhook_without_url["inbound_mode"] = json!("webhook");
    let (missing_url_status, missing_url_error) = call_api(
        &app_router,
        "POST",
        "/api/v1/messaging-services",
        Some(&webhook_without_url),
    )
    .await;
    webhook_without_url["inbound_url"] = json!("http://localhost:3000/sms/inbound");
    let webhook_service = create(
        &app_router,
        "/api/v1/messaging-services",
        &webhook_without_url,
    )
    .await;

    let service_path = format!(
        "/api/v1/messaging-services/{}",
        text(&webhook_service["sid"])
    );
    let (delete_status, _) = call_api(&app_router, "DELETE", &service_path, None).await;
    let (_, numbers) = call_api(&app_router, "GET", "/api/v1/numbers", None).await;

    assert_eq!(missing_url_status, 400);
    assert_eq!(missing_url_error["error"]["field"], "inbound_url");
    assert_eq!(webhook_service["inbound_mode"], "webhook");
    assert_eq!(delete_status, 204);
    assert_eq!(numbers[0]["messaging_service_sid"], Value::Null);
}

#[tokio::test]
async fn an_unknown_service_or_pool_number_is_refused() {
    let (app_router, _) = build_test_app();
    let mut with_unknown_service = number_input("+15550001111");
    with_unknown_service["messaging_service_sid"] = json!("MG00000000000000000000000000000000");

    let (number_status, number_error) = call_api(
        &app_router,
        "POST",
        "/api/v1/numbers",
        Some(&with_unknown_service),
    )
    .await;
    let (service_status, service_error) = call_api(
        &app_router,
        "POST",
        "/api/v1/messaging-services",
        Some(&service_input(&[&json!("01JMISSING")])),
    )
    .await;
    let (patch_status, _) = call_api(
        &app_router,
        "PATCH",
        "/api/v1/messaging-services/MGmissing",
        Some(&service_input(&[])),
    )
    .await;

    assert_eq!(
        (number_status, number_error["error"]["field"].clone()),
        (400, json!("messaging_service_sid"))
    );
    assert_eq!(
        (service_status, service_error["error"]["field"].clone()),
        (400, json!("number_ids"))
    );
    assert_eq!(patch_status, 404);
}
