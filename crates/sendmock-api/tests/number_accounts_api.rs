#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const MAIN_ACCOUNT_SID: &str = "ACtest0000000000000000000000000000";
const SHOP_SUBACCOUNT_SID: &str = "AC00000000000000000000000000000a11";
const CHOSEN_SERVICE_SID: &str = "MG0123456789abcdef0123456789abcdef";

/// A number body without `inbound_method`, so the default applies.
fn number_input(e164_number: &str, account_sid: Option<&str>) -> Value {
    json!({
        "number": e164_number,
        "label": "Shop line",
        "channels": ["sms"],
        "inbound_url": null,
        "inbound_fallback_url": null,
        "inbound_template_id": "twilio.inbound_sms",
        "status_callback_url": null,
        "messaging_service_sid": null,
        "account_sid": account_sid,
    })
}

async fn add_shop_subaccount(app_router: &axum::Router) {
    let (status, created) = call_api(
        app_router,
        "POST",
        "/api/v1/twilio/subaccounts",
        Some(&json!({
            "account_sid": SHOP_SUBACCOUNT_SID,
            "friendly_name": "Shop",
            "auth_token": "shop-token-1234",
            "debugger_url": null,
        })),
    )
    .await;
    assert_eq!(status, 201, "{created}");
}

// AC: SM-22.5
#[tokio::test]
async fn a_number_added_with_a_subaccount_belongs_to_it_and_defaults_to_post() {
    let (app_router, _) = build_test_app();
    add_shop_subaccount(&app_router).await;

    let (status, created_number) = call_api(
        &app_router,
        "POST",
        "/api/v1/numbers",
        Some(&number_input("+15550003333", Some(SHOP_SUBACCOUNT_SID))),
    )
    .await;

    assert_eq!(status, 201, "{created_number}");
    assert_eq!(created_number["account_sid"], SHOP_SUBACCOUNT_SID);
    assert_eq!(created_number["inbound_method"], "POST");
}

// AC: SM-22.5
#[tokio::test]
async fn an_update_moves_the_number_between_accounts_and_the_main_account_is_stored_as_none() {
    let (app_router, _) = build_test_app();
    add_shop_subaccount(&app_router).await;
    let (_, created_number) = call_api(
        &app_router,
        "POST",
        "/api/v1/numbers",
        Some(&number_input("+15550003333", None)),
    )
    .await;
    let number_path = format!(
        "/api/v1/numbers/{}",
        created_number["id"].as_str().unwrap_or_default()
    );

    let (moved_status, moved_number) = call_api(
        &app_router,
        "PATCH",
        &number_path,
        Some(&json!({ "account_sid": SHOP_SUBACCOUNT_SID })),
    )
    .await;
    let (_, main_number) = call_api(
        &app_router,
        "PATCH",
        &number_path,
        Some(&json!({ "account_sid": MAIN_ACCOUNT_SID })),
    )
    .await;

    assert_eq!(created_number["account_sid"], Value::Null);
    assert_eq!(moved_status, 200, "{moved_number}");
    assert_eq!(moved_number["account_sid"], SHOP_SUBACCOUNT_SID);
    assert_eq!(main_number["account_sid"], Value::Null, "{main_number}");
}

// AC: SM-22.5
#[tokio::test]
async fn an_unknown_account_is_refused_on_the_account_field() {
    let (app_router, _) = build_test_app();

    let (status, refused) = call_api(
        &app_router,
        "POST",
        "/api/v1/numbers",
        Some(&number_input(
            "+15550003333",
            Some("AC99999999999999999999999999999999"),
        )),
    )
    .await;

    assert_eq!(status, 400, "{refused}");
    assert_eq!(refused["error"]["field"], "account_sid", "{refused}");
}

// AC: SM-22.5
#[tokio::test]
async fn the_setup_file_imports_and_exports_the_numbers_account() {
    let (app_router, _) = build_test_app();
    let setup_text = format!(
        r#"[[numbers]]
number = "+15550003333"
label = "Shop line"
account_sid = "{SHOP_SUBACCOUNT_SID}"

[[sms.twilio_subaccounts]]
sid = "{SHOP_SUBACCOUNT_SID}"
name = "Shop"
"#
    );

    let (import_status, imported) = call_api(
        &app_router,
        "POST",
        "/api/v1/setup/import",
        Some(&json!({ "setup_text": setup_text })),
    )
    .await;
    let (_, numbers) = call_api(&app_router, "GET", "/api/v1/numbers", None).await;
    let (export_status, exported) = call_api(
        &app_router,
        "POST",
        "/api/v1/setup/export",
        Some(&json!({ "format": "json", "only": ["numbers"] })),
    )
    .await;

    assert_eq!(import_status, 200, "{imported}");
    assert_eq!(numbers[0]["account_sid"], SHOP_SUBACCOUNT_SID, "{numbers}");
    assert_eq!(numbers[0]["inbound_method"], "POST");
    assert_eq!(export_status, 200, "{exported}");
    assert_eq!(
        exported["numbers"][0]["account_sid"], SHOP_SUBACCOUNT_SID,
        "{exported}"
    );
}

// AC: SM-22.5
#[tokio::test]
async fn a_messaging_service_is_created_with_the_sid_asked_for_once() {
    let (app_router, _) = build_test_app();
    let service_input = json!({
        "sid": CHOSEN_SERVICE_SID,
        "friendly_name": "Notifications",
        "number_ids": [],
        "inbound_mode": "defer_to_sender",
        "inbound_url": null,
        "inbound_fallback_url": null,
    });

    let (status, created_service) = call_api(
        &app_router,
        "POST",
        "/api/v1/messaging-services",
        Some(&service_input),
    )
    .await;
    let (duplicate_status, duplicate) = call_api(
        &app_router,
        "POST",
        "/api/v1/messaging-services",
        Some(&service_input),
    )
    .await;
    let mut malformed_input = service_input.clone();
    malformed_input["sid"] = json!("MG123");
    let (malformed_status, _) = call_api(
        &app_router,
        "POST",
        "/api/v1/messaging-services",
        Some(&malformed_input),
    )
    .await;

    assert_eq!(status, 201, "{created_service}");
    assert_eq!(created_service["sid"], CHOSEN_SERVICE_SID);
    assert_eq!(duplicate_status, 409, "{duplicate}");
    assert_eq!(malformed_status, 400);
}
