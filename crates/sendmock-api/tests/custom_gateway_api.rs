#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod custom_gateway_requests;
    pub mod manual_clock;
    pub mod payment_notification_fixture;
    pub mod scripted_webhook_sender;
    pub mod test_app;
}

use serde_json::{Value, json};
use support::custom_gateway_requests::{
    API_SECRET, FAIL_URL, MERCHANT_ID, UPAY_PATH, build_request, build_upay_fixture, checkout_body,
    complete_checkout, send_raw, start_checkout, validate_payment,
};
use support::test_app::call_api;

fn read_text(json_value: &Value) -> String {
    json_value.as_str().unwrap_or_default().to_owned()
}

// AC: PY-12.3
#[tokio::test]
async fn session_init_answers_the_checkout_url_under_the_apps_reference() {
    let fixture = build_upay_fixture().await;

    let answer = start_checkout(&fixture.app_router, &checkout_body()).await;

    assert_eq!(answer.status, 201, "{}", answer.body);
    let session = answer.json();
    let payment_id = read_text(&session["payment_id"]);
    assert!(read_text(&session["checkout_url"]).ends_with(&format!("/pay/{payment_id}")));
    assert_eq!(session["reference"], "SHOP-ORDER-9");
    assert_eq!(session["status"], "requires_payment");
    assert_eq!(session["amount"], "1250.50");
    assert_eq!(session["currency"], "BDT");
    let payment = fixture.read_payment(&payment_id).await;
    assert_eq!(payment["provider"], "upay");
    assert_eq!(payment["provider_reference"], "SHOP-ORDER-9");
    assert_eq!(payment["amount_minor"], 125_050);
    assert_eq!(payment["customer_name"], "Ruma Akter");
    assert_eq!(payment["fail_url"], FAIL_URL);
    assert_eq!(payment["metadata"]["cart"], "42");
    assert_eq!(payment["line_items"][0]["name"], "Blue mug");
}

// AC: PY-12.3
#[tokio::test]
async fn session_init_takes_a_form_and_a_json_number() {
    let fixture = build_upay_fixture().await;
    let form_request = build_request(
        "POST",
        &format!("{UPAY_PATH}/checkout"),
        "application/x-www-form-urlencoded",
        "amount=500&currency=JPY&metadata%5Bcart%5D=7".to_owned(),
    );

    let form_answer = send_raw(&fixture.app_router, form_request).await;
    let number_answer = start_checkout(
        &fixture.app_router,
        &json!({ "amount": 12.5, "currency": "usd" }),
    )
    .await;

    assert_eq!(form_answer.status, 201, "{}", form_answer.body);
    assert_eq!(form_answer.json()["amount"], "500");
    let form_payment_id = read_text(&form_answer.json()["payment_id"]);
    let form_payment = fixture.read_payment(&form_payment_id).await;
    assert_eq!(form_payment["metadata"]["cart"], "7");
    assert!(read_text(&form_payment["provider_reference"]).starts_with("UPAY-"));
    assert_eq!(number_answer.status, 201, "{}", number_answer.body);
    assert_eq!(number_answer.json()["amount"], "12.50");
    assert_eq!(number_answer.json()["currency"], "USD");
}

async fn read_refusal(app_router: &axum::Router, checkout_fields: Value) -> (u16, Value) {
    let answer = start_checkout(app_router, &checkout_fields).await;
    (answer.status, answer.json()["error"].clone())
}

// AC: PY-12.3
#[tokio::test]
async fn bad_fields_and_wrong_credentials_are_refused() {
    let fixture = build_upay_fixture().await;
    let app_router = &fixture.app_router;

    let missing_amount = read_refusal(app_router, json!({ "currency": "BDT" })).await;
    let extra_decimals =
        read_refusal(app_router, json!({ "amount": "12.345", "currency": "USD" })).await;
    let unknown_currency =
        read_refusal(app_router, json!({ "amount": "5", "currency": "XYZ1" })).await;
    let wrong_secret =
        read_refusal(app_router, json!({ "amount": "5", "api_secret": "guess" })).await;
    let mut header_request = build_request(
        "POST",
        &format!("{UPAY_PATH}/checkout"),
        "application/json",
        json!({ "amount": "5" }).to_string(),
    );
    header_request
        .headers_mut()
        .insert("merchant_id", axum::http::HeaderValue::from_static("OTHER"));
    let wrong_header = send_raw(app_router, header_request).await;
    let not_an_object = send_raw(
        app_router,
        build_request(
            "POST",
            &format!("{UPAY_PATH}/checkout"),
            "application/json",
            "[1]".to_owned(),
        ),
    )
    .await;

    assert_eq!(missing_amount.0, 400);
    assert_eq!(missing_amount.1["code"], "invalid_request");
    assert_eq!(missing_amount.1["field"], "amount");
    assert_eq!(extra_decimals.1["field"], "amount");
    assert_eq!(unknown_currency.1["field"], "currency");
    assert_eq!(wrong_secret.0, 401);
    assert_eq!(wrong_secret.1["code"], "invalid_credentials");
    assert_eq!(wrong_secret.1["field"], "api_secret");
    assert_eq!(wrong_header.status, 401, "{}", wrong_header.body);
    assert_eq!(wrong_header.json()["error"]["field"], "merchant_id");
    assert_eq!(not_an_object.status, 400);
    let checkout = json!({ "amount": "5", "merchant_id": MERCHANT_ID, "api_secret": API_SECRET });
    assert_eq!(start_checkout(app_router, &checkout).await.status, 201);
}

// AC: PY-12.3
#[tokio::test]
async fn a_paid_checkout_redirects_and_notifies_as_the_definition_says() {
    let fixture = build_upay_fixture().await;
    let session = start_checkout(&fixture.app_router, &checkout_body())
        .await
        .json();
    let payment_id = read_text(&session["payment_id"]);

    let checkout_session = complete_checkout(&fixture.app_router, &payment_id, "pay").await;
    fixture.run_due().await;

    let redirect = &checkout_session["redirect"];
    assert_eq!(redirect["method"], "GET");
    assert_eq!(redirect["fields"]["payment_ref_id"], "SHOP-ORDER-9");
    assert_eq!(redirect["fields"]["status"], "COMPLETED");
    let sent_requests = fixture.sent_requests();
    let notification = sent_requests
        .iter()
        .find(|sent_request| sent_request.body.contains("COMPLETED"))
        .unwrap_or_else(|| panic!("a COMPLETED notification in {sent_requests:?}"));
    let notification_body: Value = serde_json::from_str(&notification.body).unwrap_or_default();
    assert_eq!(notification_body["payment_ref_id"], "SHOP-ORDER-9");
    assert_eq!(notification_body["amount"], "1250.50");
    assert_eq!(notification_body["merchant_id"], MERCHANT_ID);
    let signature = notification
        .headers
        .get("x-upay-signature")
        .cloned()
        .unwrap_or_default();
    assert_eq!(signature.len(), 64, "{:?}", notification.headers);
}

// AC: PY-12.3
#[tokio::test]
async fn validation_answers_the_notification_body_for_the_payment_as_it_is_now() {
    let fixture = build_upay_fixture().await;
    let session = start_checkout(&fixture.app_router, &checkout_body())
        .await
        .json();
    let payment_id = read_text(&session["payment_id"]);

    let before_paying = validate_payment(&fixture.app_router, "SHOP-ORDER-9").await;
    complete_checkout(&fixture.app_router, &payment_id, "pay").await;
    let after_paying = validate_payment(&fixture.app_router, &payment_id).await;
    let by_reference = validate_payment(&fixture.app_router, "SHOP-ORDER-9").await;

    assert_eq!(before_paying.status, 200, "{}", before_paying.body);
    assert_eq!(before_paying.content_type, "application/json");
    assert_eq!(before_paying.json()["status"], "");
    assert_eq!(before_paying.json()["payment_ref_id"], "SHOP-ORDER-9");
    assert_eq!(after_paying.status, 200, "{}", after_paying.body);
    assert_eq!(after_paying.json()["status"], "COMPLETED");
    assert_eq!(after_paying.json()["amount"], "1250.50");
    assert_eq!(by_reference.json(), after_paying.json());
}

// AC: PY-12.3
#[tokio::test]
async fn a_declined_checkout_validates_as_failed() {
    let fixture = build_upay_fixture().await;
    let session = start_checkout(&fixture.app_router, &checkout_body())
        .await
        .json();
    let payment_id = read_text(&session["payment_id"]);

    let checkout_session = complete_checkout(&fixture.app_router, &payment_id, "decline").await;
    let validation = validate_payment(&fixture.app_router, &payment_id).await;

    assert_eq!(checkout_session["redirect"]["fields"]["status"], "FAILED");
    assert_eq!(validation.json()["status"], "FAILED");
}

// AC: PY-12.3
#[tokio::test]
async fn unknown_payments_other_paths_disabled_gateways_and_builtins_are_not_served() {
    let fixture = build_upay_fixture().await;
    let app_router = &fixture.app_router;
    let stripe_payment_id = fixture.create_checkout("stripe").await;

    let unknown = validate_payment(app_router, "NO-SUCH-ORDER").await;
    let other_gateways = validate_payment(app_router, &stripe_payment_id).await;
    let other_path = send_raw(
        app_router,
        build_request(
            "POST",
            &format!("{UPAY_PATH}/refunds"),
            "application/json",
            "{}".to_owned(),
        ),
    )
    .await;
    let bkash = send_raw(
        app_router,
        build_request(
            "POST",
            "/providers/bkash/checkout",
            "application/json",
            json!({ "amount": "5" }).to_string(),
        ),
    )
    .await;
    let (_, mut upay_gateway) =
        call_api(app_router, "GET", "/api/v1/payments/gateways/upay", None).await;
    upay_gateway["is_enabled"] = json!(false);
    call_api(
        app_router,
        "PATCH",
        "/api/v1/payments/gateways/upay",
        Some(&upay_gateway),
    )
    .await;
    let disabled = start_checkout(app_router, &checkout_body()).await;

    assert_eq!(unknown.status, 404);
    assert_eq!(unknown.json()["error"]["code"], "payment_not_found");
    assert_eq!(other_gateways.json()["error"]["code"], "payment_not_found");
    assert_eq!(other_path.status, 404);
    assert!(
        other_path
            .json()
            .get("error")
            .is_none_or(|error| error["code"] != "invalid_request")
    );
    assert_eq!(bkash.status, 404, "{}", bkash.body);
    assert_eq!(disabled.status, 404, "{}", disabled.body);
}
