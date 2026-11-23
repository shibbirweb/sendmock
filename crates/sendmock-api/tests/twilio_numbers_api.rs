#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

const MAIN_ACCOUNT_SID: &str = "ACtest0000000000000000000000000000";
const OTHER_ACCOUNT_SID: &str = "AC22222222222222222222222222222222";

fn numbers_path(account_sid: &str) -> String {
    format!("/providers/twilio/2010-04-01/Accounts/{account_sid}/IncomingPhoneNumbers.json")
}

fn number_path(account_sid: &str, phone_number_sid: &str) -> String {
    format!(
        "/providers/twilio/2010-04-01/Accounts/{account_sid}/IncomingPhoneNumbers/{phone_number_sid}.json"
    )
}

async fn call_form(
    app_router: &axum::Router,
    method: &str,
    path: &str,
    form_body: &str,
) -> (u16, Value) {
    let request = Request::builder()
        .method(method)
        .uri(path)
        .header("content-type", "application/x-www-form-urlencoded")
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

async fn create_number(app_router: &axum::Router, account_sid: &str, form_body: &str) -> Value {
    let (status, created_number) =
        call_form(app_router, "POST", &numbers_path(account_sid), form_body).await;
    assert_eq!(status, 201, "{created_number}");
    created_number
}

fn read_text(answer: &Value, field_name: &str) -> String {
    answer[field_name].as_str().unwrap_or_default().to_owned()
}

// AC: SM-20.1
#[tokio::test]
async fn numbers_are_created_from_a_number_or_an_area_code_and_listed_with_filters() {
    let (app_router, _) = build_test_app();

    let created_number = create_number(
        &app_router,
        MAIN_ACCOUNT_SID,
        "PhoneNumber=%2B15557770001&FriendlyName=Support",
    )
    .await;
    let from_area = create_number(&app_router, MAIN_ACCOUNT_SID, "AreaCode=415").await;
    let (_, filtered_page) = call_form(
        &app_router,
        "GET",
        &format!("{}?FriendlyName=Support", numbers_path(MAIN_ACCOUNT_SID)),
        "",
    )
    .await;

    let phone_number_sid = read_text(&created_number, "sid");
    assert!(phone_number_sid.starts_with("PN") && phone_number_sid.len() == 34);
    assert_eq!(created_number["phone_number"], "+15557770001");
    assert_eq!(created_number["account_sid"], MAIN_ACCOUNT_SID);
    assert_eq!(created_number["capabilities"]["sms"], true);
    assert!(read_text(&from_area, "phone_number").starts_with("+1415555"));
    assert_eq!(
        filtered_page["incoming_phone_numbers"]
            .as_array()
            .map(Vec::len),
        Some(1)
    );
}

// AC: SM-20.1
#[tokio::test]
async fn a_number_is_updated_fetched_and_deleted_by_its_sid() {
    let (app_router, _) = build_test_app();
    let created_number =
        create_number(&app_router, MAIN_ACCOUNT_SID, "PhoneNumber=%2B15557770001").await;
    let one_number_path = number_path(MAIN_ACCOUNT_SID, &read_text(&created_number, "sid"));

    let (update_status, updated_number) = call_form(
        &app_router,
        "POST",
        &one_number_path,
        "SmsUrl=https%3A%2F%2Fshop.test%2Fsms&SmsMethod=GET&StatusCallback=https%3A%2F%2Fshop.test%2Fstatus",
    )
    .await;
    let (fetch_status, fetched_number) = call_form(&app_router, "GET", &one_number_path, "").await;
    let (delete_status, _) = call_form(&app_router, "DELETE", &one_number_path, "").await;
    let (gone_status, _) = call_form(&app_router, "GET", &one_number_path, "").await;

    assert_eq!(update_status, 200);
    assert_eq!(updated_number["sms_url"], "https://shop.test/sms");
    assert_eq!(updated_number["sms_method"], "GET");
    assert_eq!(fetch_status, 200);
    assert_eq!(
        fetched_number["status_callback"],
        "https://shop.test/status"
    );
    assert_eq!(delete_status, 204);
    assert_eq!(gone_status, 404);
}

// AC: SM-20.2
#[tokio::test]
async fn a_number_lists_only_under_its_account_and_a_bad_or_taken_number_is_refused() {
    let (app_router, _) = build_test_app();
    let other_number =
        create_number(&app_router, OTHER_ACCOUNT_SID, "PhoneNumber=%2B15557770002").await;

    let (_, main_page) = call_form(&app_router, "GET", &numbers_path(MAIN_ACCOUNT_SID), "").await;
    let (_, other_page) = call_form(&app_router, "GET", &numbers_path(OTHER_ACCOUNT_SID), "").await;
    let (invalid_status, invalid_error) = call_form(
        &app_router,
        "POST",
        &numbers_path(MAIN_ACCOUNT_SID),
        "PhoneNumber=555-0100",
    )
    .await;
    let (taken_status, taken_error) = call_form(
        &app_router,
        "POST",
        &numbers_path(MAIN_ACCOUNT_SID),
        "PhoneNumber=%2B15557770002",
    )
    .await;

    assert_eq!(other_number["account_sid"], OTHER_ACCOUNT_SID);
    assert_eq!(main_page["incoming_phone_numbers"], json!([]));
    assert_eq!(
        other_page["incoming_phone_numbers"][0]["phone_number"],
        "+15557770002"
    );
    assert_eq!(invalid_status, 400);
    assert_eq!(invalid_error["code"], 21421);
    assert_eq!(taken_status, 400);
    assert_eq!(taken_error["code"], 21422);
}

// AC: SM-20.3
#[tokio::test]
async fn numbers_made_in_the_api_show_on_the_numbers_screen_and_the_other_way_round() {
    let (app_router, _) = build_test_app();
    let api_number = create_number(
        &app_router,
        MAIN_ACCOUNT_SID,
        "PhoneNumber=%2B15557770003&FriendlyName=From+the+API",
    )
    .await;
    let screen_number_input = json!({
        "number": "+15557770004", "label": "From the screen", "channels": ["sms"],
        "inbound_url": null, "inbound_method": "POST", "inbound_fallback_url": null,
        "inbound_template_id": null, "status_callback_url": null, "messaging_service_sid": null,
    });
    call_api(
        &app_router,
        "POST",
        "/api/v1/numbers",
        Some(&screen_number_input),
    )
    .await;

    let (_, registered_numbers) = call_api(&app_router, "GET", "/api/v1/numbers", None).await;
    let (_, api_page) = call_form(&app_router, "GET", &numbers_path(MAIN_ACCOUNT_SID), "").await;

    let registered_labels: Vec<Value> = registered_numbers
        .as_array()
        .map(|numbers| {
            numbers
                .iter()
                .map(|number| number["label"].clone())
                .collect()
        })
        .unwrap_or_default();
    assert!(registered_labels.contains(&json!("From the API")));
    assert_eq!(
        registered_numbers[0]["phone_number_sid"],
        api_number["sid"].clone()
    );
    let api_phone_numbers: Vec<Value> = api_page["incoming_phone_numbers"]
        .as_array()
        .map(|numbers| {
            numbers
                .iter()
                .map(|number| number["phone_number"].clone())
                .collect()
        })
        .unwrap_or_default();
    assert!(api_phone_numbers.contains(&json!("+15557770004")));
}

/// A number and two Messaging Services; answers the number's SID and both pool paths.
async fn create_number_and_two_services(app_router: &axum::Router) -> (String, String, String) {
    let pooled_number =
        create_number(app_router, MAIN_ACCOUNT_SID, "PhoneNumber=%2B15557770005").await;
    let mut pool_paths = Vec::new();
    for friendly_name in ["Alerts", "Promos"] {
        let (_, created_service) = call_form(
            app_router,
            "POST",
            "/providers/twilio/v1/Services",
            &format!("FriendlyName={friendly_name}"),
        )
        .await;
        pool_paths.push(format!(
            "/providers/twilio/v1/Services/{}/PhoneNumbers",
            read_text(&created_service, "sid")
        ));
    }
    let second_path = pool_paths.pop().unwrap_or_default();
    let first_path = pool_paths.pop().unwrap_or_default();
    (read_text(&pooled_number, "sid"), first_path, second_path)
}

// AC: SM-20.4
#[tokio::test]
async fn a_service_adds_lists_and_fetches_numbers_in_twilios_phone_number_shape() {
    let (app_router, _) = build_test_app();
    let (phone_number_sid, first_path, _) = create_number_and_two_services(&app_router).await;

    let (add_status, added_number) = call_form(
        &app_router,
        "POST",
        &first_path,
        &format!("PhoneNumberSid={phone_number_sid}"),
    )
    .await;
    let (_, pool_page) = call_form(&app_router, "GET", &first_path, "").await;
    let (fetch_status, _) = call_form(
        &app_router,
        "GET",
        &format!("{first_path}/{phone_number_sid}"),
        "",
    )
    .await;

    assert_eq!(add_status, 201, "{added_number}");
    assert_eq!(added_number["sid"], phone_number_sid.as_str());
    assert!(read_text(&added_number, "service_sid").starts_with("MG"));
    assert_eq!(added_number["country_code"], "US");
    assert_eq!(added_number["capabilities"], json!(["SMS", "MMS"]));
    assert_eq!(pool_page["phone_numbers"].as_array().map(Vec::len), Some(1));
    assert_eq!(pool_page["meta"]["key"], "phone_numbers");
    assert_eq!(fetch_status, 200);
}

// AC: SM-20.4
#[tokio::test]
async fn a_number_in_another_service_is_refused_and_a_removed_one_leaves_the_pool() {
    let (app_router, _) = build_test_app();
    let (phone_number_sid, first_path, second_path) =
        create_number_and_two_services(&app_router).await;
    let add_form = format!("PhoneNumberSid={phone_number_sid}");
    call_form(&app_router, "POST", &first_path, &add_form).await;

    let (conflict_status, conflict_error) =
        call_form(&app_router, "POST", &second_path, &add_form).await;
    let (remove_status, _) = call_form(
        &app_router,
        "DELETE",
        &format!("{first_path}/{phone_number_sid}"),
        "",
    )
    .await;
    let (_, emptied_page) = call_form(&app_router, "GET", &first_path, "").await;

    assert_eq!(conflict_status, 409);
    assert_eq!(conflict_error["code"], 21712);
    assert_eq!(remove_status, 204);
    assert_eq!(emptied_page["phone_numbers"], json!([]));
}
