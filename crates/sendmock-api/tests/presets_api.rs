#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const APPLY_PATH: &str = "/api/v1/presets/laravel-mailgun-twilio/apply";

async fn apply_preset(app_router: &axum::Router, body: &Value) -> Value {
    let (status, answer) = call_api(app_router, "POST", APPLY_PATH, Some(body)).await;
    assert_eq!(status, 200, "{answer}");
    answer
}

fn list_items(listed: &Value) -> Vec<Value> {
    listed
        .get("items")
        .unwrap_or(listed)
        .as_array()
        .cloned()
        .unwrap_or_default()
}

// AC: PL-27.1 PL-27.2
#[tokio::test]
async fn the_preset_sets_up_mailgun_and_twilio_at_the_apps_paths_and_prints_the_env_block() {
    let (app_router, _) = build_test_app();

    let applied = apply_preset(
        &app_router,
        &json!({
            "app_url": "http://localhost:8000/",
            "options": { "mailgun_events_path": "/hooks/mailgun" },
        }),
    )
    .await;
    let (_, endpoints) = call_api(&app_router, "GET", "/api/v1/webhooks/endpoints", None).await;
    let (_, numbers) = call_api(&app_router, "GET", "/api/v1/numbers", None).await;
    let (_, twilio) = call_api(&app_router, "GET", "/api/v1/sms/providers/twilio", None).await;

    let endpoint_urls: Vec<String> = list_items(&endpoints)
        .iter()
        .map(|endpoint| endpoint["url"].as_str().unwrap_or_default().to_owned())
        .collect();
    assert!(
        endpoint_urls.contains(&"http://localhost:8000/hooks/mailgun".to_owned()),
        "{endpoint_urls:?}"
    );
    assert!(endpoint_urls.contains(&"http://localhost:8000/webhooks/mailgun/inbound".to_owned()));
    assert_eq!(numbers[0]["number"], "+15005550006", "{numbers}");
    assert_eq!(
        numbers[0]["inbound_url"],
        "http://localhost:8000/webhooks/twilio/inbound"
    );
    let debugger_url = twilio["credentials"]
        .as_array()
        .into_iter()
        .flatten()
        .find(|credential| credential["name"] == "debugger_url")
        .map(|credential| credential["value"].clone());
    assert_eq!(
        debugger_url,
        Some(json!("http://localhost:8000/webhooks/twilio/debugger"))
    );
    let env_block = applied["env_block"].as_str().unwrap_or_default();
    assert!(
        env_block.contains("MAILGUN_WEBHOOK_SIGNING_KEY=key-"),
        "{env_block}"
    );
    assert!(env_block.contains("TWILIO_FROM=+15005550006"));
    assert_eq!(applied["steps"][0], "Made the Mailgun signing key.");
}

// AC: PL-27.4
#[tokio::test]
async fn a_second_run_changes_nothing() {
    let (app_router, _) = build_test_app();
    let body = json!({ "app_url": "http://localhost:8000" });
    let first_run = apply_preset(&app_router, &body).await;
    let (_, endpoints_after_first) =
        call_api(&app_router, "GET", "/api/v1/webhooks/endpoints", None).await;
    let (_, rules_after_first) = call_api(&app_router, "GET", "/api/v1/webhooks/rules", None).await;

    let second_run = apply_preset(&app_router, &body).await;
    let (_, endpoints_after_second) =
        call_api(&app_router, "GET", "/api/v1/webhooks/endpoints", None).await;
    let (_, rules_after_second) =
        call_api(&app_router, "GET", "/api/v1/webhooks/rules", None).await;

    assert_eq!(
        list_items(&endpoints_after_first).len(),
        list_items(&endpoints_after_second).len()
    );
    assert_eq!(
        list_items(&rules_after_first).len(),
        list_items(&rules_after_second).len()
    );
    assert_eq!(
        second_run["steps"][0], "Kept the Mailgun signing key.",
        "{second_run}"
    );
    assert_eq!(first_run["env_block"], second_run["env_block"]);
}

// AC: PL-27.3
#[tokio::test]
async fn imported_numbers_get_their_subaccount_and_label() {
    let (app_router, _) = build_test_app();
    call_api(
        &app_router,
        "POST",
        "/api/v1/twilio/subaccounts",
        Some(&json!({
            "account_sid": "AC22222222222222222222222222222222", "friendly_name": "Clinic",
            "auth_token": "clinic-token", "debugger_url": null,
        })),
    )
    .await;

    let applied = apply_preset(
        &app_router,
        &json!({
            "app_url": "http://localhost:8000",
            "numbers_csv": "number,label,subaccount_sid,messaging_service_sid\n+15550007000,Clinic line,AC22222222222222222222222222222222,\n",
        }),
    )
    .await;
    let (_, numbers) = call_api(&app_router, "GET", "/api/v1/numbers", None).await;

    let clinic_number = list_items(&numbers)
        .into_iter()
        .find(|number| number["number"] == "+15550007000")
        .unwrap_or_default();
    assert_eq!(clinic_number["label"], "Clinic line", "{numbers}");
    assert_eq!(
        clinic_number["account_sid"],
        "AC22222222222222222222222222222222"
    );
    assert!(
        applied["steps"].to_string().contains("1 numbers"),
        "{applied}"
    );
}

#[tokio::test]
async fn an_unknown_preset_or_a_bad_app_url_is_refused() {
    let (app_router, _) = build_test_app();

    let (missing_status, _) = call_api(
        &app_router,
        "POST",
        "/api/v1/presets/rails-sendgrid/apply",
        Some(&json!({ "app_url": "http://localhost:3000" })),
    )
    .await;
    let (bad_url_status, _) = call_api(
        &app_router,
        "POST",
        APPLY_PATH,
        Some(&json!({ "app_url": "localhost" })),
    )
    .await;

    assert_eq!(missing_status, 404);
    assert_eq!(bad_url_status, 400);
}

// AC: PL-27.5
#[tokio::test]
async fn a_csv_row_naming_a_new_messaging_service_creates_it_with_that_sid() {
    let (app_router, _) = build_test_app();
    let service_sid = "MG0123456789abcdef0123456789abcdef";

    apply_preset(
        &app_router,
        &json!({
            "app_url": "http://localhost:8000",
            "numbers_csv": format!("number,label,subaccount_sid,messaging_service_sid\n+15550007001,Shop line,,{service_sid}\n"),
        }),
    )
    .await;
    let (_, service) = call_api(
        &app_router,
        "GET",
        &format!("/api/v1/messaging-services/{service_sid}"),
        None,
    )
    .await;
    let (_, numbers) = call_api(&app_router, "GET", "/api/v1/numbers", None).await;
    let shop_line = list_items(&numbers)
        .into_iter()
        .find(|number| number["number"] == "+15550007001")
        .unwrap_or(Value::Null);

    assert_eq!(service["sid"], service_sid, "{service}");
    assert_eq!(shop_line["messaging_service_sid"], service_sid, "{numbers}");
    assert_eq!(service["number_ids"], json!([shop_line["id"]]), "{service}");
}

// AC: PL-27.6
#[tokio::test]
async fn a_csv_with_bad_rows_changes_nothing_and_names_every_bad_row() {
    let (app_router, _) = build_test_app();
    let (_, endpoints_before) =
        call_api(&app_router, "GET", "/api/v1/webhooks/endpoints", None).await;

    let (status, refusal) = call_api(
        &app_router,
        "POST",
        APPLY_PATH,
        Some(&json!({
            "app_url": "http://localhost:8000",
            "numbers_csv": "number,label,subaccount_sid,messaging_service_sid\n+15550007002,Good line,,\nnot-a-number,Bad number,,\n+15550007003,Unknown account,AC99999999999999999999999999999999,\n",
        })),
    )
    .await;
    let (_, endpoints_after) =
        call_api(&app_router, "GET", "/api/v1/webhooks/endpoints", None).await;
    let (_, numbers_after) = call_api(&app_router, "GET", "/api/v1/numbers", None).await;
    let message = refusal["error"]["message"].as_str().unwrap_or_default();

    assert_eq!(status, 400, "{refusal}");
    assert!(
        message.contains("line 3") && message.contains("line 4"),
        "{message}"
    );
    assert!(!message.contains("line 2"), "{message}");
    assert_eq!(endpoints_after, endpoints_before);
    assert!(
        list_items(&numbers_after)
            .iter()
            .all(|number| number["number"] != "+15550007002"),
        "{numbers_after}"
    );
}
