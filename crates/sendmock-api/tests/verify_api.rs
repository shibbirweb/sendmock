#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

fn service_input(fixed_code: Option<&str>) -> Value {
    json!({ "friendly_name": "Shop", "code_length": 6, "fixed_code": fixed_code, "ttl_seconds": 600 })
}

async fn start_sample_verification(app_router: &axum::Router) -> Value {
    let (status, created_sample) = call_api(
        app_router,
        "POST",
        "/api/v1/samples/verification",
        Some(&json!({})),
    )
    .await;
    assert_eq!(status, 201, "{created_sample}");
    let verification_path = format!(
        "/api/v1/verify/{}",
        created_sample["id"].as_str().unwrap_or_default()
    );
    call_api(app_router, "GET", &verification_path, None)
        .await
        .1
}

// AC: VF-01.3
#[tokio::test]
async fn services_are_created_edited_and_deleted_with_the_rules_enforced() {
    let (app_router, _) = build_test_app();
    let (create_status, created_service) = call_api(
        &app_router,
        "POST",
        "/api/v1/verify/services",
        Some(&service_input(None)),
    )
    .await;
    let service_path = format!(
        "/api/v1/verify/services/{}",
        created_service["sid"].as_str().unwrap_or_default()
    );
    let mut changed_input = service_input(Some("12345678"));
    changed_input["code_length"] = json!(8);

    let (patch_status, changed_service) =
        call_api(&app_router, "PATCH", &service_path, Some(&changed_input)).await;
    let (delete_status, _) = call_api(&app_router, "DELETE", &service_path, None).await;
    let (_, remaining_services) =
        call_api(&app_router, "GET", "/api/v1/verify/services", None).await;

    assert_eq!(create_status, 201);
    assert!(
        created_service["sid"]
            .as_str()
            .is_some_and(|sid| sid.starts_with("VA") && sid.len() == 34)
    );
    assert_eq!(
        (patch_status, changed_service["fixed_code"].clone()),
        (200, json!("12345678"))
    );
    assert_eq!(delete_status, 204);
    assert_eq!(remaining_services, json!([]));
    let invalid_cases = [
        (
            json!({ "friendly_name": " ", "code_length": 6, "fixed_code": null, "ttl_seconds": 600 }),
            "friendly_name",
        ),
        (
            json!({ "friendly_name": "Shop", "code_length": 3, "fixed_code": null, "ttl_seconds": 600 }),
            "code_length",
        ),
        (
            json!({ "friendly_name": "Shop", "code_length": 6, "fixed_code": "1234", "ttl_seconds": 600 }),
            "fixed_code",
        ),
        (
            json!({ "friendly_name": "Shop", "code_length": 6, "fixed_code": null, "ttl_seconds": 30 }),
            "ttl_seconds",
        ),
    ];
    for (invalid_input, expected_field) in invalid_cases {
        let (status, error_body) = call_api(
            &app_router,
            "POST",
            "/api/v1/verify/services",
            Some(&invalid_input),
        )
        .await;
        assert_eq!(
            (status, error_body["error"]["field"].clone()),
            (400, json!(expected_field))
        );
    }
}

// AC: VF-02.2
// AC: VF-04.4
#[tokio::test]
async fn a_verification_sends_its_code_as_a_captured_sms_linked_from_the_timeline() {
    let (app_router, _) = build_test_app();

    let verification = start_sample_verification(&app_router).await;
    let sms_path = format!(
        "/api/v1/sms/{}",
        verification["linked_message_id"]
            .as_str()
            .unwrap_or_default()
    );
    let (_, code_sms) = call_api(&app_router, "GET", &sms_path, None).await;
    let (_, threads) = call_api(&app_router, "GET", "/api/v1/sms/threads", None).await;

    assert_eq!(verification["status"], "pending");
    assert_eq!(verification["send_attempts"], 1);
    assert_eq!(verification["timeline"][0]["kind"], "started");
    assert_eq!(verification["timeline"][1]["kind"], "code_sent");
    assert_eq!(verification["linked_thread_id"], threads[0]["thread_id"]);
    assert_eq!(
        code_sms["body"],
        format!(
            "Your SendMock verification code is: {}",
            verification["code"].as_str().unwrap_or_default()
        )
    );
    assert_eq!(code_sms["api"], "twilio_verify");
}

// AC: VF-02.4
#[tokio::test]
async fn the_otp_lookup_returns_the_verification_code() {
    let (app_router, _) = build_test_app();
    let verification = start_sample_verification(&app_router).await;

    let (status, otp_lookup) = call_api(
        &app_router,
        "GET",
        "/api/v1/otp?to=%2B14155550100&channel=verify",
        None,
    )
    .await;

    assert_eq!(status, 200);
    assert_eq!(otp_lookup["code"], verification["code"]);
    assert_eq!(otp_lookup["source_id"], verification["sid"]);
}

// AC: VF-04.1
// AC: VF-04.2
#[tokio::test]
async fn forcing_a_state_changes_it_at_once_and_fires_its_event() {
    let (app_router, _) = build_test_app();
    let verification = start_sample_verification(&app_router).await;
    let force_path = format!(
        "/api/v1/verify/{}/force",
        verification["sid"].as_str().unwrap_or_default()
    );

    let (status, forced) = call_api(
        &app_router,
        "POST",
        &force_path,
        Some(&json!({ "state": "max_attempts" })),
    )
    .await;
    call_api(
        &app_router,
        "POST",
        &force_path,
        Some(&json!({ "state": "expired" })),
    )
    .await;
    let (_, events) = call_api(&app_router, "GET", "/api/v1/events/recent", None).await;

    let event_types: Vec<Value> = events
        .as_array()
        .map(|events| events.iter().map(|event| event["type"].clone()).collect())
        .unwrap_or_default();
    assert_eq!(status, 200);
    assert_eq!(forced["status"], "max_attempts_reached");
    assert_eq!(
        forced["timeline"]
            .as_array()
            .and_then(|timeline| timeline.last())
            .map(|entry| entry["kind"].clone()),
        Some(json!("max_attempts_reached"))
    );
    for expected_type in ["verify.started", "verify.checked", "verify.expired"] {
        assert!(
            event_types.contains(&json!(expected_type)),
            "{expected_type} in {event_types:?}"
        );
    }
}

#[tokio::test]
async fn reset_deletes_sms_and_verifications_but_keeps_numbers() {
    let (app_router, _) = build_test_app();
    start_sample_verification(&app_router).await;
    let number_input = json!({
        "number": "+15557770001", "label": "Kept", "channels": ["sms"], "inbound_url": null,
        "inbound_method": "POST", "inbound_fallback_url": null, "inbound_template_id": null,
        "status_callback_url": null, "messaging_service_sid": null,
    });
    call_api(&app_router, "POST", "/api/v1/numbers", Some(&number_input)).await;

    call_api(&app_router, "POST", "/api/v1/reset", None).await;
    let (_, sms_page) = call_api(&app_router, "GET", "/api/v1/sms", None).await;
    let (_, verification_page) = call_api(&app_router, "GET", "/api/v1/verify", None).await;
    let (_, numbers) = call_api(&app_router, "GET", "/api/v1/numbers", None).await;

    assert_eq!(sms_page["total_count"], 0);
    assert_eq!(verification_page["total_count"], 0);
    assert_eq!(numbers.as_array().map(Vec::len), Some(1));
}
