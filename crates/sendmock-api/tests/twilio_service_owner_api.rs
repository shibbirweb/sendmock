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

const MAIN_ACCOUNT: (&str, &str) = ("ACtest0000000000000000000000000000", "twilio-test-token");
const SHOP_ACCOUNT: (&str, &str) = ("AC22222222222222222222222222222222", "shop-token-1234");
const CLINIC_ACCOUNT: (&str, &str) = ("AC33333333333333333333333333333333", "clinic-token-5678");

/// Calls the Twilio API under `/providers/twilio` as an account, with its token.
async fn call_twilio_as(
    app_router: &axum::Router,
    method: &str,
    path: &str,
    form_body: &str,
    (account_sid, auth_token): (&str, &str),
) -> (u16, Value) {
    let credentials = STANDARD.encode(format!("{account_sid}:{auth_token}"));
    let request = Request::builder()
        .method(method)
        .uri(format!("/providers/twilio{path}"))
        .header("content-type", "application/x-www-form-urlencoded")
        .header("authorization", format!("Basic {credentials}"))
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

/// An app with the shop and clinic subaccounts.
async fn build_app_with_two_subaccounts() -> axum::Router {
    let (app_router, _) = build_test_app();
    for (friendly_name, (account_sid, auth_token)) in
        [("Shop", SHOP_ACCOUNT), ("Clinic", CLINIC_ACCOUNT)]
    {
        let (status, created) = call_api(
            &app_router,
            "POST",
            "/api/v1/twilio/subaccounts",
            Some(&json!({
                "account_sid": account_sid,
                "friendly_name": friendly_name,
                "auth_token": auth_token,
                "debugger_url": null,
            })),
        )
        .await;
        assert_eq!(status, 201, "{created}");
    }
    app_router
}

async fn create_service_as(
    app_router: &axum::Router,
    friendly_name: &str,
    account: (&str, &str),
) -> String {
    let (status, created) = call_twilio_as(
        app_router,
        "POST",
        "/v1/Services",
        &format!("FriendlyName={friendly_name}"),
        account,
    )
    .await;
    assert_eq!(status, 201, "{created}");
    assert_eq!(created["account_sid"], account.0, "{created}");
    created["sid"].as_str().unwrap_or_default().to_owned()
}

async fn list_service_sids_as(app_router: &axum::Router, account: (&str, &str)) -> Vec<Value> {
    let (status, listed) = call_twilio_as(app_router, "GET", "/v1/Services", "", account).await;
    assert_eq!(status, 200, "{listed}");
    listed["services"]
        .as_array()
        .map(|services| {
            services
                .iter()
                .map(|service| service["sid"].clone())
                .collect()
        })
        .unwrap_or_default()
}

// AC: SM-22.10
#[tokio::test]
async fn each_account_lists_and_reads_only_its_own_messaging_services() {
    let app_router = build_app_with_two_subaccounts().await;
    let shop_service_sid = create_service_as(&app_router, "Shop", SHOP_ACCOUNT).await;
    let clinic_service_sid = create_service_as(&app_router, "Clinic", CLINIC_ACCOUNT).await;

    let shop_services = list_service_sids_as(&app_router, SHOP_ACCOUNT).await;
    let clinic_services = list_service_sids_as(&app_router, CLINIC_ACCOUNT).await;
    let main_services = list_service_sids_as(&app_router, MAIN_ACCOUNT).await;
    let shop_service_path = format!("/v1/Services/{shop_service_sid}");
    let (fetch_status, fetch_refusal) =
        call_twilio_as(&app_router, "GET", &shop_service_path, "", CLINIC_ACCOUNT).await;
    let (numbers_status, numbers_refusal) = call_twilio_as(
        &app_router,
        "GET",
        &format!("{shop_service_path}/PhoneNumbers"),
        "",
        CLINIC_ACCOUNT,
    )
    .await;
    let (delete_status, _) = call_twilio_as(
        &app_router,
        "DELETE",
        &shop_service_path,
        "",
        CLINIC_ACCOUNT,
    )
    .await;
    let (own_fetch_status, own_service) =
        call_twilio_as(&app_router, "GET", &shop_service_path, "", SHOP_ACCOUNT).await;

    assert_eq!(shop_services, vec![json!(shop_service_sid)]);
    assert_eq!(clinic_services, vec![json!(clinic_service_sid)]);
    assert!(main_services.is_empty(), "{main_services:?}");
    assert_eq!(fetch_status, 404, "{fetch_refusal}");
    assert_eq!(fetch_refusal["code"], 20404, "{fetch_refusal}");
    assert_eq!(numbers_status, 404, "{numbers_refusal}");
    assert_eq!(numbers_refusal["code"], 20404, "{numbers_refusal}");
    assert_eq!(delete_status, 404);
    assert_eq!(own_fetch_status, 200, "{own_service}");
    assert_eq!(own_service["account_sid"], SHOP_ACCOUNT.0);
}

// AC: SM-22.10
#[tokio::test]
async fn a_service_made_in_sendmock_takes_an_account_and_keeps_it_through_a_change() {
    let app_router = build_app_with_two_subaccounts().await;

    let (create_status, created) = call_api(
        &app_router,
        "POST",
        "/api/v1/messaging-services",
        Some(&json!({ "friendly_name": "Clinic reminders", "account_sid": CLINIC_ACCOUNT.0 })),
    )
    .await;
    let service_sid = created["sid"].as_str().unwrap_or_default().to_owned();
    let (_, changed) = call_api(
        &app_router,
        "PATCH",
        &format!("/api/v1/messaging-services/{service_sid}"),
        Some(&json!({ "friendly_name": "Clinic texts" })),
    )
    .await;
    let (unknown_status, unknown_answer) = call_api(
        &app_router,
        "POST",
        "/api/v1/messaging-services",
        Some(&json!({
            "friendly_name": "Nobody's",
            "account_sid": "AC99999999999999999999999999999999",
        })),
    )
    .await;
    let (_, main_created) = call_api(
        &app_router,
        "POST",
        "/api/v1/messaging-services",
        Some(&json!({ "friendly_name": "Main", "account_sid": MAIN_ACCOUNT.0 })),
    )
    .await;

    assert_eq!(create_status, 201, "{created}");
    assert_eq!(created["account_sid"], CLINIC_ACCOUNT.0);
    assert_eq!(changed["account_sid"], CLINIC_ACCOUNT.0, "{changed}");
    assert_eq!(
        list_service_sids_as(&app_router, CLINIC_ACCOUNT).await,
        vec![json!(service_sid)]
    );
    assert_eq!(unknown_status, 400, "{unknown_answer}");
    assert_eq!(unknown_answer["error"]["field"], "account_sid");
    assert_eq!(main_created["account_sid"], Value::Null, "{main_created}");
}

// AC: SM-22.10
#[tokio::test]
async fn a_send_through_an_unknown_service_makes_it_for_the_sending_account() {
    let app_router = build_app_with_two_subaccounts().await;
    let unknown_service_sid = "MG44444444444444444444444444444444";

    let (status, sent) = call_twilio_as(
        &app_router,
        "POST",
        &format!("/2010-04-01/Accounts/{}/Messages.json", SHOP_ACCOUNT.0),
        &format!("To=%2B8801700000000&MessagingServiceSid={unknown_service_sid}&Body=Hi"),
        SHOP_ACCOUNT,
    )
    .await;

    assert_eq!(status, 201, "{sent}");
    assert_eq!(
        list_service_sids_as(&app_router, SHOP_ACCOUNT).await,
        vec![json!(unknown_service_sid)]
    );
    assert!(
        list_service_sids_as(&app_router, CLINIC_ACCOUNT)
            .await
            .is_empty()
    );
}
