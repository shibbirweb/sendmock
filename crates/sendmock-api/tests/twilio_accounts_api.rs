#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod recording_callback_sender;
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use std::sync::Arc;

use sendmock_ops::sign_twilio_request;
use serde_json::{Value, json};
use support::recording_callback_sender::RecordingCallbackSender;
use support::test_app::{build_test_app, build_test_app_with, call_api, call_api_text};
use tower::ServiceExt;

const MAIN_ACCOUNT_SID: &str = "ACtest00000000000000000000000000";
const MAIN_AUTH_TOKEN: &str = "twilio-test-token";
const ACCOUNTS_PATH: &str = "/providers/twilio/2010-04-01/Accounts.json";

fn account_path(account_sid: &str) -> String {
    format!("/providers/twilio/2010-04-01/Accounts/{account_sid}.json")
}

fn basic_auth(account_sid: &str, auth_token: &str) -> String {
    format!(
        "Basic {}",
        STANDARD.encode(format!("{account_sid}:{auth_token}"))
    )
}

/// Calls the provider port with a form body and, when given, Basic auth.
async fn call_twilio(
    app_router: &axum::Router,
    method: &str,
    path: &str,
    form_body: &str,
    authorization: Option<&str>,
) -> (u16, Value) {
    let mut request_builder = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/x-www-form-urlencoded");
    if let Some(authorization) = authorization {
        request_builder = request_builder.header("authorization", authorization);
    }
    let request = request_builder
        .body(Body::from(form_body.to_owned()))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    (
        status,
        serde_json::from_slice(&body_bytes).unwrap_or(Value::Null),
    )
}

fn main_auth() -> String {
    basic_auth(MAIN_ACCOUNT_SID, MAIN_AUTH_TOKEN)
}

async fn create_subaccount_over_the_provider_port(
    app_router: &axum::Router,
    friendly_name: &str,
) -> Value {
    let (status, created_account) = call_twilio(
        app_router,
        "POST",
        ACCOUNTS_PATH,
        &format!("FriendlyName={friendly_name}"),
        Some(&main_auth()),
    )
    .await;
    assert_eq!(status, 201, "{created_account}");
    created_account
}

// AC: SM-19.1
#[tokio::test]
async fn the_main_account_and_a_subaccount_are_fetched_in_twilios_account_shape() {
    let (app_router, _) = build_test_app();
    let created_account = create_subaccount_over_the_provider_port(&app_router, "Shop").await;
    let subaccount_sid = created_account["sid"]
        .as_str()
        .unwrap_or_default()
        .to_owned();

    let (main_status, main_account) = call_twilio(
        &app_router,
        "GET",
        &account_path(MAIN_ACCOUNT_SID),
        "",
        Some(&main_auth()),
    )
    .await;
    let (sub_status, subaccount) = call_twilio(
        &app_router,
        "GET",
        &account_path(&subaccount_sid),
        "",
        Some(&main_auth()),
    )
    .await;

    assert_eq!(main_status, 200);
    assert_eq!(main_account["sid"], MAIN_ACCOUNT_SID);
    assert_eq!(main_account["auth_token"], MAIN_AUTH_TOKEN);
    assert_eq!(main_account["owner_account_sid"], MAIN_ACCOUNT_SID);
    assert_eq!(main_account["type"], "Full");
    assert_eq!(sub_status, 200);
    assert_eq!(subaccount["friendly_name"], "Shop");
    assert_eq!(subaccount["status"], "active");
    assert_eq!(subaccount["owner_account_sid"], MAIN_ACCOUNT_SID);
    assert_eq!(
        subaccount["uri"],
        format!("/2010-04-01/Accounts/{subaccount_sid}.json")
    );
    assert_eq!(
        subaccount["subresource_uris"]["messages"],
        format!("/2010-04-01/Accounts/{subaccount_sid}/Messages.json")
    );
    assert!(
        subaccount["date_created"]
            .as_str()
            .is_some_and(|date| date.ends_with("+0000"))
    );
    assert_eq!(
        subaccount["auth_token"].as_str().map(str::len),
        Some(32),
        "a generated token is 32 hex digits"
    );
}

// AC: SM-19.1
#[tokio::test]
async fn an_unknown_account_answers_twilios_404() {
    let (app_router, _) = build_test_app();

    let (status, error) = call_twilio(
        &app_router,
        "GET",
        &account_path("AC99999999999999999999999999999999"),
        "",
        Some(&main_auth()),
    )
    .await;

    assert_eq!(status, 404);
    assert_eq!(error["code"], 20404);
}

// AC: SM-19.2
#[tokio::test]
async fn accounts_are_listed_with_filters_created_and_updated() {
    let (app_router, _) = build_test_app();
    create_subaccount_over_the_provider_port(&app_router, "Shop").await;
    let second_account = create_subaccount_over_the_provider_port(&app_router, "Clinic").await;
    let second_sid = second_account["sid"]
        .as_str()
        .unwrap_or_default()
        .to_owned();

    let (_, every_account) =
        call_twilio(&app_router, "GET", ACCOUNTS_PATH, "", Some(&main_auth())).await;
    let (_, named_accounts) = call_twilio(
        &app_router,
        "GET",
        &format!("{ACCOUNTS_PATH}?FriendlyName=Clinic"),
        "",
        Some(&main_auth()),
    )
    .await;
    let (update_status, updated_account) = call_twilio(
        &app_router,
        "POST",
        &account_path(&second_sid),
        "FriendlyName=Clinic+North&Status=suspended",
        Some(&main_auth()),
    )
    .await;
    let (_, suspended_accounts) = call_twilio(
        &app_router,
        "GET",
        &format!("{ACCOUNTS_PATH}?Status=suspended"),
        "",
        Some(&main_auth()),
    )
    .await;

    assert_eq!(every_account["accounts"].as_array().map(Vec::len), Some(3));
    assert_eq!(every_account["page_size"], 50);
    assert_eq!(named_accounts["accounts"].as_array().map(Vec::len), Some(1));
    assert_eq!(named_accounts["accounts"][0]["sid"], second_sid.as_str());
    assert_eq!(update_status, 200);
    assert_eq!(updated_account["friendly_name"], "Clinic North");
    assert_eq!(updated_account["status"], "suspended");
    assert_eq!(
        suspended_accounts["accounts"].as_array().map(Vec::len),
        Some(1)
    );
}

// AC: SM-19.3
#[tokio::test]
async fn the_account_endpoints_check_credentials_even_with_check_credentials_off() {
    let (app_router, _) = build_test_app();
    let created_account = create_subaccount_over_the_provider_port(&app_router, "Shop").await;
    let subaccount_sid = created_account["sid"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    let subaccount_auth = basic_auth(
        &subaccount_sid,
        created_account["auth_token"].as_str().unwrap_or_default(),
    );

    let (anonymous_status, anonymous_error) =
        call_twilio(&app_router, "GET", ACCOUNTS_PATH, "", None).await;
    let (wrong_status, _) = call_twilio(
        &app_router,
        "GET",
        ACCOUNTS_PATH,
        "",
        Some(&basic_auth(MAIN_ACCOUNT_SID, "wrong-token")),
    )
    .await;
    let (_, seen_by_subaccount) = call_twilio(
        &app_router,
        "GET",
        ACCOUNTS_PATH,
        "",
        Some(&subaccount_auth),
    )
    .await;
    let (main_by_subaccount_status, _) = call_twilio(
        &app_router,
        "GET",
        &account_path(MAIN_ACCOUNT_SID),
        "",
        Some(&subaccount_auth),
    )
    .await;

    assert_eq!(anonymous_status, 401);
    assert_eq!(anonymous_error["code"], 20003);
    assert_eq!(wrong_status, 401);
    assert_eq!(
        seen_by_subaccount["accounts"].as_array().map(Vec::len),
        Some(1)
    );
    assert_eq!(
        seen_by_subaccount["accounts"][0]["sid"],
        subaccount_sid.as_str()
    );
    assert_eq!(main_by_subaccount_status, 404);
}

// AC: SM-19.3
#[tokio::test]
async fn the_request_log_masks_the_tokens_in_the_answer() {
    let (app_router, _) = build_test_app();
    call_twilio(
        &app_router,
        "GET",
        &account_path(MAIN_ACCOUNT_SID),
        "",
        Some(&main_auth()),
    )
    .await;

    let (_, logged_page) = call_api(&app_router, "GET", "/api/v1/logs/http?api=twilio", None).await;

    let logged_answer = logged_page["items"][0]["response_body"]
        .as_str()
        .unwrap_or_default();
    assert!(!logged_answer.is_empty(), "{logged_page}");
    assert!(!logged_answer.contains(MAIN_AUTH_TOKEN), "{logged_answer}");
}

const SHOP_SUBACCOUNT_SID: &str = "AC22222222222222222222222222222222";
const SHOP_SUBACCOUNT_PATH: &str = "/api/v1/twilio/subaccounts/AC22222222222222222222222222222222";

fn shop_subaccount_input() -> Value {
    json!({
        "account_sid": SHOP_SUBACCOUNT_SID,
        "friendly_name": "Shop",
        "auth_token": "shop-token-1234",
        "debugger_url": "https://shop.test/twilio/debugger",
    })
}

async fn reveal_shop_token(app_router: &axum::Router) -> Value {
    let (_, revealed) = call_api(
        app_router,
        "GET",
        &format!("{SHOP_SUBACCOUNT_PATH}/auth-token"),
        None,
    )
    .await;
    revealed["auth_token"].clone()
}

// AC: SM-19.4
#[tokio::test]
async fn a_subaccount_added_through_rest_shows_its_token_masked_until_revealed() {
    let (app_router, _) = build_test_app();

    let (create_status, created) = call_api(
        &app_router,
        "POST",
        "/api/v1/twilio/subaccounts",
        Some(&shop_subaccount_input()),
    )
    .await;
    let (duplicate_status, _) = call_api(
        &app_router,
        "POST",
        "/api/v1/twilio/subaccounts",
        Some(&shop_subaccount_input()),
    )
    .await;

    assert_eq!(create_status, 201, "{created}");
    assert_eq!(created["auth_token"], "••••1234");
    assert_eq!(created["debugger_url"], "https://shop.test/twilio/debugger");
    assert_eq!(duplicate_status, 409);
    assert_eq!(reveal_shop_token(&app_router).await, "shop-token-1234");
}

// AC: SM-19.4
#[tokio::test]
async fn a_subaccount_edit_keeps_a_masked_token_and_a_removal_empties_the_list() {
    let (app_router, _) = build_test_app();
    call_api(
        &app_router,
        "POST",
        "/api/v1/twilio/subaccounts",
        Some(&shop_subaccount_input()),
    )
    .await;
    let kept_token_update = json!({
        "friendly_name": "Shop EU",
        "status": "suspended",
        "auth_token": "••••1234",
        "debugger_url": null,
    });

    let (update_status, updated) = call_api(
        &app_router,
        "PATCH",
        SHOP_SUBACCOUNT_PATH,
        Some(&kept_token_update),
    )
    .await;
    let token_after_update = reveal_shop_token(&app_router).await;
    let (delete_status, _) = call_api(&app_router, "DELETE", SHOP_SUBACCOUNT_PATH, None).await;
    let (_, listed_after_delete) =
        call_api(&app_router, "GET", "/api/v1/twilio/subaccounts", None).await;

    assert_eq!(update_status, 200, "{updated}");
    assert_eq!(updated["friendly_name"], "Shop EU");
    assert_eq!(updated["status"], "suspended");
    assert_eq!(updated["debugger_url"], Value::Null);
    assert_eq!(token_after_update, "shop-token-1234");
    assert_eq!(delete_status, 204);
    assert_eq!(listed_after_delete, json!([]));
}

// AC: SM-19.4
#[tokio::test]
async fn a_subaccount_sid_that_is_not_ac_and_32_hex_digits_is_refused() {
    let (app_router, _) = build_test_app();

    let (status, error) = call_api(
        &app_router,
        "POST",
        "/api/v1/twilio/subaccounts",
        Some(&json!({ "account_sid": "AC123", "friendly_name": "Shop" })),
    )
    .await;

    assert_eq!(status, 400, "{error}");
    assert_eq!(error["field"], "account_sid");
}

// AC: SM-19.4
#[tokio::test]
async fn the_seed_file_adds_subaccounts_with_tokens_from_the_environment_and_exports_references() {
    let (app_router, _) = build_test_app();
    let seed_toml = r#"
[[sms.twilio_subaccounts]]
sid = "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
name = "Seeded shop"
status = "active"
auth_token = "${SHOP_TWILIO_TOKEN}"
"#;

    let (apply_status, applied) = call_api(
        &app_router,
        "POST",
        "/api/v1/seed/apply",
        Some(&json!({ "seed_toml": seed_toml })),
    )
    .await;
    let (_, listed) = call_api(&app_router, "GET", "/api/v1/twilio/subaccounts", None).await;
    let (_, _, exported_seed) = call_api_text(&app_router, "/api/v1/seed/export").await;

    assert_eq!(apply_status, 200, "{applied}");
    assert_eq!(
        listed[0]["account_sid"],
        "ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    );
    assert_eq!(listed[0]["friendly_name"], "Seeded shop");
    assert!(
        exported_seed.contains("[[sms.twilio_subaccounts]]"),
        "{exported_seed}"
    );
    assert!(
        exported_seed.contains("${TWILIO_ACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA_AUTH_TOKEN_SECRET}"),
        "{exported_seed}"
    );
}

// AC: SM-19.5
#[tokio::test]
async fn a_send_under_a_suspended_subaccount_is_refused_and_nothing_is_stored() {
    let (app_router, _) = build_test_app();
    let created_account = create_subaccount_over_the_provider_port(&app_router, "Shop").await;
    let subaccount_sid = created_account["sid"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    call_twilio(
        &app_router,
        "POST",
        &account_path(&subaccount_sid),
        "Status=suspended",
        Some(&main_auth()),
    )
    .await;

    let (status, error) = call_twilio(
        &app_router,
        "POST",
        &format!("/providers/twilio/2010-04-01/Accounts/{subaccount_sid}/Messages.json"),
        "To=%2B8801700000000&From=%2B15005550006&Body=Hi",
        Some(&main_auth()),
    )
    .await;
    let (_, stored_page) = call_api(&app_router, "GET", "/api/v1/sms", None).await;

    assert_eq!(status, 403, "{error}");
    assert_eq!(error["code"], 20005);
    assert_eq!(stored_page["items"], json!([]));
}

async fn build_app_with_callback_recorder() -> (axum::Router, Arc<RecordingCallbackSender>) {
    let callback_sender = Arc::new(RecordingCallbackSender::default());
    let sender_for_context = Arc::clone(&callback_sender);
    let (app_router, _) = build_test_app_with(move |operation_context| {
        operation_context.with_status_callback_sender(sender_for_context)
    });
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "sms_simulation_profile": "instant" })),
    )
    .await;
    (app_router, callback_sender)
}

fn read_callback_form(callback_body: &str) -> Value {
    let pairs: Vec<(String, String)> =
        serde_urlencoded::from_str(callback_body).unwrap_or_default();
    Value::Object(
        pairs
            .into_iter()
            .map(|(name, value)| (name, Value::from(value)))
            .collect(),
    )
}

// AC: SM-19.5
#[tokio::test]
async fn status_callbacks_for_a_subaccount_message_are_signed_with_its_token() {
    let (app_router, callback_sender) = build_app_with_callback_recorder().await;
    call_api(
        &app_router,
        "POST",
        "/api/v1/twilio/subaccounts",
        Some(&shop_subaccount_input()),
    )
    .await;
    let callback_url = "http://127.0.0.1:9/sms/status";

    let (status, _) = call_twilio(
        &app_router,
        "POST",
        &format!("/providers/twilio/2010-04-01/Accounts/{SHOP_SUBACCOUNT_SID}/Messages.json"),
        &format!(
            "To=%2B8801700000000&From=%2B15005550006&Body=Hi&StatusCallback={}",
            callback_url.replace(':', "%3A").replace('/', "%2F")
        ),
        Some(&basic_auth(SHOP_SUBACCOUNT_SID, "shop-token-1234")),
    )
    .await;
    let callback_requests = callback_sender.wait_for_requests(1).await;

    assert_eq!(status, 201);
    let callback_form = read_callback_form(&callback_requests[0].body);
    let signature = &callback_requests[0].headers["X-Twilio-Signature"];
    assert_eq!(callback_form["AccountSid"], SHOP_SUBACCOUNT_SID);
    assert_eq!(
        signature,
        &sign_twilio_request(callback_url, &callback_form, "shop-token-1234")
    );
    assert_ne!(
        signature,
        &sign_twilio_request(callback_url, &callback_form, MAIN_AUTH_TOKEN)
    );
}
