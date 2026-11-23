#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

const MAIN_ACCOUNT_SID: &str = "ACtest0000000000000000000000000000";
const MAIN_AUTH_TOKEN: &str = "twilio-test-token";
const SHOP_SUBACCOUNT_SID: &str = "AC22222222222222222222222222222222";
const SHOP_AUTH_TOKEN: &str = "shop-token-1234";

fn basic_auth(account_sid: &str, auth_token: &str) -> String {
    format!(
        "Basic {}",
        STANDARD.encode(format!("{account_sid}:{auth_token}"))
    )
}

/// Calls the Twilio API under `/providers/twilio` as `account_sid`, with its token.
async fn call_twilio_as(
    app_router: &axum::Router,
    method: &str,
    path: &str,
    form_body: &str,
    (account_sid, auth_token): (&str, &str),
) -> (u16, Value) {
    let request = Request::builder()
        .method(method)
        .uri(format!("/providers/twilio{path}"))
        .header("content-type", "application/x-www-form-urlencoded")
        .header("authorization", basic_auth(account_sid, auth_token))
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

/// An app with the shop subaccount and one message sent under it; answers the message SID.
async fn build_app_with_shop_message() -> (axum::Router, String) {
    let (app_router, _) = build_test_app();
    let (status, created) = call_api(
        &app_router,
        "POST",
        "/api/v1/twilio/subaccounts",
        Some(&json!({
            "account_sid": SHOP_SUBACCOUNT_SID,
            "friendly_name": "Shop",
            "auth_token": SHOP_AUTH_TOKEN,
            "debugger_url": null,
        })),
    )
    .await;
    assert_eq!(status, 201, "{created}");
    let (send_status, sent) = call_twilio_as(
        &app_router,
        "POST",
        &format!("/2010-04-01/Accounts/{SHOP_SUBACCOUNT_SID}/Messages.json"),
        "To=%2B8801700000000&From=%2B15005550006&Body=Hi",
        (SHOP_SUBACCOUNT_SID, SHOP_AUTH_TOKEN),
    )
    .await;
    assert_eq!(send_status, 201, "{sent}");
    let message_sid = sent["sid"].as_str().unwrap_or_default().to_owned();
    (app_router, message_sid)
}

// AC: SM-22.3
#[tokio::test]
async fn the_main_account_cannot_fetch_a_subaccounts_message() {
    let (app_router, message_sid) = build_app_with_shop_message().await;

    let (status, refused) = call_twilio_as(
        &app_router,
        "GET",
        &format!("/2010-04-01/Accounts/{MAIN_ACCOUNT_SID}/Messages/{message_sid}.json"),
        "",
        (MAIN_ACCOUNT_SID, MAIN_AUTH_TOKEN),
    )
    .await;

    assert_eq!(status, 404, "{refused}");
    assert_eq!(refused["code"], 20404);
}

// AC: SM-22.3
#[tokio::test]
async fn the_owner_fetches_its_message_and_sees_itself_as_the_account() {
    let (app_router, message_sid) = build_app_with_shop_message().await;

    let (status, fetched) = call_twilio_as(
        &app_router,
        "GET",
        &format!("/2010-04-01/Accounts/{SHOP_SUBACCOUNT_SID}/Messages/{message_sid}.json"),
        "",
        (SHOP_SUBACCOUNT_SID, SHOP_AUTH_TOKEN),
    )
    .await;

    assert_eq!(status, 200, "{fetched}");
    assert_eq!(fetched["sid"], message_sid);
    assert_eq!(fetched["account_sid"], SHOP_SUBACCOUNT_SID);
}

// AC: SM-22.3
#[tokio::test]
async fn each_account_lists_only_its_own_messages() {
    let (app_router, message_sid) = build_app_with_shop_message().await;

    let (_, main_page) = call_twilio_as(
        &app_router,
        "GET",
        &format!("/2010-04-01/Accounts/{MAIN_ACCOUNT_SID}/Messages.json"),
        "",
        (MAIN_ACCOUNT_SID, MAIN_AUTH_TOKEN),
    )
    .await;
    let (_, shop_page) = call_twilio_as(
        &app_router,
        "GET",
        &format!("/2010-04-01/Accounts/{SHOP_SUBACCOUNT_SID}/Messages.json"),
        "",
        (SHOP_SUBACCOUNT_SID, SHOP_AUTH_TOKEN),
    )
    .await;

    assert_eq!(main_page["messages"], json!([]), "{main_page}");
    assert_eq!(shop_page["messages"][0]["sid"], message_sid, "{shop_page}");
    assert_eq!(shop_page["messages"][0]["account_sid"], SHOP_SUBACCOUNT_SID);
}

/// The note of the newest request-log entry.
async fn read_newest_log_note(app_router: &axum::Router) -> Value {
    let (_, request_log) = call_api(app_router, "GET", "/api/v1/logs/http", None).await;
    request_log["items"][0]["note"].clone()
}

// AC: SM-22.4
#[tokio::test]
async fn a_twilio_401_keeps_twilios_body_and_the_log_says_why() {
    let (app_router, _) = build_app_with_shop_message().await;
    let shop_account_path = format!("/2010-04-01/Accounts/{SHOP_SUBACCOUNT_SID}.json");

    let (wrong_token_status, wrong_token_body) = call_twilio_as(
        &app_router,
        "GET",
        &shop_account_path,
        "",
        (SHOP_SUBACCOUNT_SID, "guess"),
    )
    .await;
    let wrong_token_note = read_newest_log_note(&app_router).await;
    call_twilio_as(
        &app_router,
        "GET",
        &shop_account_path,
        "",
        ("AC99999999999999999999999999999999", "guess"),
    )
    .await;
    let unknown_account_note = read_newest_log_note(&app_router).await;
    call_twilio_as(
        &app_router,
        "GET",
        &format!("/2010-04-01/Accounts/{MAIN_ACCOUNT_SID}.json"),
        "",
        (SHOP_SUBACCOUNT_SID, "wrong"),
    )
    .await;
    let borrowed_path_note = read_newest_log_note(&app_router).await;

    assert_eq!(wrong_token_status, 401);
    assert_eq!(wrong_token_body["code"], 20003, "{wrong_token_body}");
    assert_eq!(wrong_token_body["message"], "Authenticate");
    assert_eq!(
        wrong_token_note,
        format!("Wrong auth token for {SHOP_SUBACCOUNT_SID}")
    );
    assert!(
        unknown_account_note
            .as_str()
            .unwrap_or_default()
            .starts_with("Unknown account AC99999999999999999999999999999999"),
        "the log note names the unknown account"
    );
    assert!(
        borrowed_path_note
            .as_str()
            .unwrap_or_default()
            .starts_with(&format!("The path's account {MAIN_ACCOUNT_SID} is not")),
        "the log note names the account in the path"
    );
}
