#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

const PROVIDERS_PATH: &str = "/api/v1/sms/providers";
const VONAGE_FORM: &str = "from=AcmeInc&to=447700900000&text=Hi&api_key=k&api_secret=s";

/// A provider as the API answers it, cut down to the fields `PATCH` takes.
async fn read_provider_input(app_router: &axum::Router, provider_key: &str) -> Value {
    let (_, mut provider) = call_api(
        app_router,
        "GET",
        &format!("{PROVIDERS_PATH}/{provider_key}"),
        None,
    )
    .await;
    let Some(fields) = provider.as_object_mut() else {
        panic!("{provider_key} is a JSON object");
    };
    for read_only_field in [
        "area",
        "is_builtin",
        "is_modified",
        "is_removed",
        "message_count_24h",
    ] {
        fields.remove(read_only_field);
    }
    provider
}

async fn send_vonage(app_router: &axum::Router) -> u16 {
    let request = Request::post("/providers/vonage/sms/json")
        .header("content-type", "application/x-www-form-urlencoded")
        .body(Body::from(VONAGE_FORM))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"))
        .status()
        .as_u16()
}

// AC: SM-16.1
// AC: SM-16.6
#[tokio::test]
async fn the_list_shows_the_built_ins_with_secrets_masked_and_recent_message_counts() {
    let (app_router, _) = build_test_app();
    send_vonage(&app_router).await;

    let (status, providers) = call_api(&app_router, "GET", PROVIDERS_PATH, None).await;

    let provider_keys: Vec<&str> = providers
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|provider| provider["key"].as_str())
        .collect();
    let vonage = &providers[2];
    assert_eq!(status, 200);
    assert_eq!(
        provider_keys,
        vec!["twilio", "twilio_verify", "vonage", "plivo", "messagebird"]
    );
    assert_eq!(vonage["is_builtin"], true);
    assert_eq!(vonage["is_modified"], false);
    assert_eq!(vonage["message_count_24h"], 1);
    assert_eq!(vonage["credentials"][1]["value"], "••••cret");
    assert_eq!(providers[0]["message_count_24h"], 0);
}

// AC: SM-16.3
// AC: SM-16.5
#[tokio::test]
async fn an_edit_applies_to_the_next_request_and_reset_brings_back_the_shipped_answer() {
    let (app_router, _) = build_test_app();
    let mut vonage_input = read_provider_input(&app_router, "vonage").await;
    vonage_input["success_response"]["status"] = json!(202);
    vonage_input["name"] = json!("Vonage EU");

    let (edit_status, edited) = call_api(
        &app_router,
        "PATCH",
        &format!("{PROVIDERS_PATH}/vonage"),
        Some(&vonage_input),
    )
    .await;
    let edited_send_status = send_vonage(&app_router).await;
    let (reset_status, reset) = call_api(
        &app_router,
        "POST",
        &format!("{PROVIDERS_PATH}/vonage/reset"),
        None,
    )
    .await;
    let reset_send_status = send_vonage(&app_router).await;

    assert_eq!(edit_status, 200);
    assert_eq!(edited["is_modified"], true);
    assert_eq!(edited["name"], "Vonage EU");
    assert_eq!(edited_send_status, 202);
    assert_eq!(reset_status, 200);
    assert_eq!(reset["is_modified"], false);
    assert_eq!(reset["name"], "Vonage");
    assert_eq!(reset_send_status, 200);
}

// AC: SM-16.6
#[tokio::test]
async fn a_masked_secret_sent_back_keeps_the_stored_value_which_the_reveal_answers() {
    let (app_router, _) = build_test_app();
    let vonage_input = read_provider_input(&app_router, "vonage").await;

    call_api(
        &app_router,
        "PATCH",
        &format!("{PROVIDERS_PATH}/vonage"),
        Some(&vonage_input),
    )
    .await;
    let (reveal_status, revealed) = call_api(
        &app_router,
        "GET",
        &format!("{PROVIDERS_PATH}/vonage/credentials/api_secret"),
        None,
    )
    .await;
    let (unknown_status, _) = call_api(
        &app_router,
        "GET",
        &format!("{PROVIDERS_PATH}/vonage/credentials/password"),
        None,
    )
    .await;

    assert_eq!(vonage_input["credentials"][1]["value"], "••••cret");
    assert_eq!(reveal_status, 200);
    assert_eq!(
        revealed,
        json!({ "name": "api_secret", "value": "vonage-secret" })
    );
    assert_eq!(unknown_status, 404);
}

// AC: SM-16.3
// AC: SM-16.5
#[tokio::test]
async fn a_removed_built_in_answers_the_native_404_until_it_is_restored() {
    let (app_router, _) = build_test_app();

    let (remove_status, _) = call_api(
        &app_router,
        "DELETE",
        &format!("{PROVIDERS_PATH}/vonage"),
        None,
    )
    .await;
    let removed_send_status = send_vonage(&app_router).await;
    let (_, removed) = call_api(
        &app_router,
        "GET",
        &format!("{PROVIDERS_PATH}/vonage"),
        None,
    )
    .await;
    let (restore_status, restored) = call_api(
        &app_router,
        "POST",
        &format!("{PROVIDERS_PATH}/vonage/restore"),
        None,
    )
    .await;
    let restored_send_status = send_vonage(&app_router).await;
    let (second_restore_status, second_restore) = call_api(
        &app_router,
        "POST",
        &format!("{PROVIDERS_PATH}/vonage/restore"),
        None,
    )
    .await;

    assert_eq!(remove_status, 204);
    assert_eq!(removed_send_status, 404);
    assert_eq!(
        (
            removed["is_removed"].clone(),
            removed["is_modified"].clone()
        ),
        (json!(true), json!(false))
    );
    assert_eq!(
        (restore_status, restored["is_removed"].clone()),
        (200, json!(false))
    );
    assert_eq!(restored_send_status, 200);
    assert_eq!(second_restore_status, 409);
    assert_eq!(second_restore["error"]["code"], "not_removed");
}

#[tokio::test]
async fn an_unknown_provider_is_not_found() {
    let (app_router, _) = build_test_app();

    let (show_status, _) = call_api(
        &app_router,
        "GET",
        &format!("{PROVIDERS_PATH}/sslwireless"),
        None,
    )
    .await;
    let (reset_status, _) = call_api(
        &app_router,
        "POST",
        &format!("{PROVIDERS_PATH}/sslwireless/reset"),
        None,
    )
    .await;

    assert_eq!((show_status, reset_status), (404, 404));
}

// AC: SM-16.4
#[tokio::test]
async fn a_save_with_a_path_clash_a_bad_path_or_a_template_error_is_refused_with_the_reason() {
    let (app_router, _) = build_test_app();
    let vonage_path = format!("{PROVIDERS_PATH}/vonage");
    let vonage_input = read_provider_input(&app_router, "vonage").await;
    let mut clashing_input = vonage_input.clone();
    clashing_input["operations"][0]["path"] =
        json!("/2010-04-01/Accounts/{AccountSid}/Messages.json");
    clashing_input["host"] = Value::Null;
    let mut reserved_path_input = vonage_input.clone();
    reserved_path_input["operations"][0]["path"] = json!("/api/v1/sms");
    let mut template_error_input = vonage_input.clone();
    template_error_input["message_id_template"] = json!("{{ random_hex(16)");

    let (clash_status, clash) =
        call_api(&app_router, "PATCH", &vonage_path, Some(&clashing_input)).await;
    let (reserved_status, reserved) = call_api(
        &app_router,
        "PATCH",
        &vonage_path,
        Some(&reserved_path_input),
    )
    .await;
    let (template_status, template) = call_api(
        &app_router,
        "PATCH",
        &vonage_path,
        Some(&template_error_input),
    )
    .await;
    let (_, unchanged) = call_api(&app_router, "GET", &vonage_path, None).await;

    assert_eq!(clash_status, 400);
    assert!(
        clash["error"]["message"]
            .as_str()
            .is_some_and(|message| message.contains("same path as Twilio"))
    );
    assert_eq!(reserved_status, 400);
    assert!(
        reserved["error"]["message"]
            .as_str()
            .is_some_and(|message| message.contains("SendMock's own path"))
    );
    assert_eq!(template_status, 400);
    assert!(
        template["error"]["message"]
            .as_str()
            .is_some_and(|message| message.starts_with("Message id:"))
    );
    assert_eq!(unchanged["is_modified"], false);
}

// AC: SM-16.4
#[tokio::test]
async fn the_preview_answers_the_stored_message_and_response_and_names_template_problems() {
    let (app_router, _) = build_test_app();
    let mut twilio_input = read_provider_input(&app_router, "twilio").await;
    let preview_path = format!("{PROVIDERS_PATH}/twilio/preview");

    let (status, preview) = call_api(
        &app_router,
        "POST",
        &preview_path,
        Some(&json!({ "provider": twilio_input.clone() })),
    )
    .await;
    twilio_input["success_response"]["body"] = json!("{\"sid\": \"{{ message.missing_field }}\"}");
    let (_, warned_preview) = call_api(
        &app_router,
        "POST",
        &preview_path,
        Some(&json!({ "provider": twilio_input })),
    )
    .await;

    assert_eq!(status, 200);
    assert_eq!(preview["operation_kind"], "send");
    assert_eq!(preview["stored_message"]["to"], json!(["+15551234567"]));
    assert_eq!(preview["stored_message"]["subject"], Value::Null);
    assert_eq!(preview["response"]["status"], 201);
    assert_eq!(preview["problems"], json!([]));
    assert!(
        preview["reference"]["fields"]
            .as_array()
            .is_some_and(|fields| !fields.is_empty())
    );
    assert_eq!(
        warned_preview["problems"][0]["part"],
        "Success response body"
    );
    assert_eq!(warned_preview["problems"][0]["severity"], "warning");
}

// AC: SM-16.4
#[tokio::test]
async fn the_preview_answers_the_providers_error_for_a_refused_sample() {
    let (app_router, _) = build_test_app();
    let twilio_input = read_provider_input(&app_router, "twilio").await;

    let (_, preview) = call_api(
        &app_router,
        "POST",
        &format!("{PROVIDERS_PATH}/twilio/preview"),
        Some(&json!({
            "provider": twilio_input,
            "sample_request": {
                "method": "POST",
                "path": "/2010-04-01/Accounts/ACtest00000000000000000000000000/Messages.json",
                "headers": { "content-type": "application/x-www-form-urlencoded" },
                "body": "From=%2B15005550006&Body=Hi",
            },
        })),
    )
    .await;

    assert_eq!(preview["operation_kind"], "send");
    assert_eq!(preview["stored_message"], Value::Null);
    assert_eq!(preview["response"]["status"], 400);
    assert!(
        preview["response"]["body"]
            .as_str()
            .is_some_and(|body| body.contains("21604"))
    );
}
