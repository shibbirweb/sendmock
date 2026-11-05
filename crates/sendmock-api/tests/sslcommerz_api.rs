#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod payment_notification_fixture;
    pub mod scripted_webhook_sender;
    pub mod test_app;
}

use std::collections::BTreeMap;

use axum::body::Body;
use axum::http::Request;
use sendmock_payments::sign_sslcommerz_fields;
use serde_json::{Value, json};
use support::payment_notification_fixture::{NotificationFixture, build_fixture};
use support::scripted_webhook_sender::ScriptedWebhookSender;
use support::test_app::call_api;
use tower::ServiceExt;

const SSLCOMMERZ_PATH: &str = "/providers/sslcommerz";
const STORE_ID: &str = "sendm0000000001";
const STORE_PASSWORD: &str = "sendm0000000001@ssl";
const SUCCESS_URL: &str = "https://shop.example/sslcommerz/success";
const FAIL_URL: &str = "https://shop.example/sslcommerz/fail";
const CANCEL_URL: &str = "https://shop.example/sslcommerz/cancel";

async fn send_request(router: axum::Router, request: Request<Body>) -> (u16, Value) {
    let response = router
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

fn build_form_request(uri: &str, form_fields: &[(&str, &str)]) -> Request<Body> {
    let form_body = serde_urlencoded::to_string(form_fields).unwrap_or_default();
    Request::builder()
        .method("POST")
        .uri(uri)
        .header("content-type", "application/x-www-form-urlencoded")
        .body(Body::from(form_body))
        .unwrap_or_else(|error| panic!("a valid request: {error}"))
}

/// A session as SSLCommerz's PHP library starts one, with the given fields changed.
async fn init_session(app_router: &axum::Router, changed_fields: &[(&str, &str)]) -> Value {
    let mut session_fields = vec![
        ("store_id", STORE_ID),
        ("store_passwd", STORE_PASSWORD),
        ("total_amount", "1250.50"),
        ("currency", "BDT"),
        ("tran_id", "SHOP-ORDER-7"),
        ("success_url", SUCCESS_URL),
        ("fail_url", FAIL_URL),
        ("cancel_url", CANCEL_URL),
        ("cus_name", "Ruma Akter"),
        ("cus_email", "ruma@example.com"),
        ("cus_phone", "01711111111"),
        ("product_name", "Blue mug"),
        ("value_a", "cart-42"),
    ];
    for (field_name, field_value) in changed_fields {
        session_fields.retain(|(kept_name, _)| kept_name != field_name);
        if !field_value.is_empty() {
            session_fields.push((field_name, field_value));
        }
    }
    let session_request = build_form_request(
        &format!("{SSLCOMMERZ_PATH}/gwprocess/v4/api.php"),
        &session_fields,
    );
    let (status, session) = send_request(app_router.clone(), session_request).await;
    assert_eq!(status, 200, "{session}");
    session
}

fn read_payment_id(session: &Value) -> String {
    session["GatewayPageURL"]
        .as_str()
        .and_then(|page_url| page_url.rsplit('/').next())
        .unwrap_or_default()
        .to_owned()
}

async fn complete_checkout(app_router: &axum::Router, payment_id: &str, checkout: Value) -> Value {
    let (status, session) = call_api(
        app_router,
        "POST",
        &format!("/api/v1/checkout-sessions/{payment_id}/complete"),
        Some(&checkout),
    )
    .await;
    assert_eq!(status, 200, "{session}");
    session
}

fn pay_with_card(card_number: &str) -> Value {
    json!({
        "action": "pay", "method_key": "card",
        "card": { "number": card_number, "exp_month": 12, "exp_year": 2030, "cvc": "123" },
    })
}

async fn validate_order(app_router: &axum::Router, val_id: &str, store_password: &str) -> Value {
    let query = serde_urlencoded::to_string([
        ("val_id", val_id),
        ("store_id", STORE_ID),
        ("store_passwd", store_password),
        ("format", "json"),
        ("v", "1"),
    ])
    .unwrap_or_default();
    let validation_request = Request::builder()
        .method("GET")
        .uri(format!(
            "{SSLCOMMERZ_PATH}/validator/api/validationserverAPI.php?{query}"
        ))
        .body(Body::empty())
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let (status, validated_order) = send_request(app_router.clone(), validation_request).await;
    assert_eq!(status, 200, "{validated_order}");
    validated_order
}

/// Checks `verify_sign` as SSLCommerz's PHP library does: the fields `verify_key` names,
/// with the MD5 of the store password, sorted and hashed.
fn has_valid_sign(posted_fields: &BTreeMap<String, String>) -> bool {
    let read_field = |field_name: &str| posted_fields.get(field_name).cloned().unwrap_or_default();
    let signed_fields: BTreeMap<String, String> = read_field("verify_key")
        .split(',')
        .filter_map(|field_name| {
            posted_fields
                .get(field_name)
                .map(|field_value| (field_name.to_owned(), field_value.clone()))
        })
        .collect();
    !signed_fields.is_empty()
        && sign_sslcommerz_fields(STORE_PASSWORD, &signed_fields) == read_field("verify_sign")
}

fn read_form(form_body: &str) -> BTreeMap<String, String> {
    serde_urlencoded::from_str(form_body).unwrap_or_default()
}

fn read_redirect_fields(checkout_session: &Value) -> BTreeMap<String, String> {
    serde_json::from_value(checkout_session["redirect"]["fields"].clone()).unwrap_or_default()
}

async fn build_sslcommerz_fixture() -> NotificationFixture {
    build_fixture(ScriptedWebhookSender::default(), &["sslcommerz"]).await
}

/// The IPN SSLCommerz posted last, as its fields.
async fn read_last_ipn(fixture: &NotificationFixture) -> BTreeMap<String, String> {
    fixture.run_due().await;
    let sent_requests = fixture.sent_requests();
    let last_ipn = sent_requests
        .last()
        .unwrap_or_else(|| panic!("an IPN was sent"));
    assert_eq!(
        last_ipn.headers.get("content-type").map(String::as_str),
        Some("application/x-www-form-urlencoded")
    );
    read_form(&last_ipn.body)
}

// AC: PY-06.1
#[tokio::test]
async fn session_init_answers_the_gateway_page_and_a_session_key() {
    let fixture = build_sslcommerz_fixture().await;

    let session = init_session(&fixture.app_router, &[]).await;

    assert_eq!(session["status"], "SUCCESS");
    assert_eq!(session["failedreason"], "");
    let session_key = session["sessionkey"].as_str().unwrap_or_default();
    assert_eq!(session_key.len(), 32);
    let payment_id = read_payment_id(&session);
    assert!(
        session["GatewayPageURL"]
            .as_str()
            .is_some_and(|page_url| page_url.ends_with(&format!("/pay/{payment_id}")))
    );
    assert_eq!(session["gw"]["visa"], "visacard");
    assert_eq!(session["gw"]["mobilebanking"], "bkash,nagad,rocket");
    let payment = fixture.read_payment(&payment_id).await;
    assert_eq!(payment["provider_reference"], "SHOP-ORDER-7");
    assert_eq!(payment["amount_minor"], 125_050);
    assert_eq!(payment["customer_email"], "ruma@example.com");
    assert_eq!(payment["provider_ids"]["sessionkey"], session_key);
    assert_eq!(payment["fail_url"], FAIL_URL);
}

// AC: PY-06.1
#[tokio::test]
async fn wrong_store_credentials_and_missing_fields_get_sslcommerz_failures() {
    let fixture = build_sslcommerz_fixture().await;

    let wrong_password = init_session(&fixture.app_router, &[("store_passwd", "guess")]).await;
    let unknown_store = init_session(&fixture.app_router, &[("store_id", "otherstore")]).await;
    let without_tran_id = init_session(&fixture.app_router, &[("tran_id", "")]).await;
    let bad_amount = init_session(&fixture.app_router, &[("total_amount", "12.345")]).await;

    for refused_session in [&wrong_password, &unknown_store] {
        assert_eq!(refused_session["status"], "FAILED");
        assert_eq!(
            refused_session["failedreason"],
            "Store Credential Error Or Store is De-active"
        );
        assert_eq!(refused_session["sessionkey"], "");
        assert_eq!(refused_session["GatewayPageURL"], "");
    }
    assert_eq!(
        without_tran_id["failedreason"],
        "Invalid Information! 'tran_id' is missing."
    );
    assert_eq!(
        bad_amount["failedreason"],
        "Invalid Information! 'total_amount' is invalid."
    );
    let (_, payments) = call_api(&fixture.app_router, "GET", "/api/v1/payments", None).await;
    assert_eq!(payments["items"], json!([]));
}

// AC: PY-06.1
#[tokio::test]
async fn the_provider_port_serves_sslcommerz_at_its_real_paths() {
    let fixture = build_sslcommerz_fixture().await;
    let provider_port_router =
        sendmock_api::build_provider_port_router(&fixture.operation_context, None);
    let mut session_request = build_form_request(
        "/gwprocess/v4/api.php",
        &[
            ("store_id", STORE_ID),
            ("store_passwd", STORE_PASSWORD),
            ("total_amount", "100"),
            ("currency", "BDT"),
            ("tran_id", "PORT-1"),
            ("success_url", SUCCESS_URL),
            ("fail_url", FAIL_URL),
            ("cancel_url", CANCEL_URL),
        ],
    );
    session_request.headers_mut().insert(
        "host",
        axum::http::HeaderValue::from_static("sandbox.sslcommerz.com"),
    );

    let (status, session) = send_request(provider_port_router, session_request).await;

    assert_eq!(status, 200, "{session}");
    assert_eq!(session["status"], "SUCCESS");
}

// AC: PY-06.2
#[tokio::test]
async fn the_ipn_posts_the_transaction_with_a_verify_sign_the_store_password_checks() {
    let fixture = build_sslcommerz_fixture().await;
    let payment_id = read_payment_id(&init_session(&fixture.app_router, &[]).await);

    complete_checkout(
        &fixture.app_router,
        &payment_id,
        pay_with_card("4242424242424242"),
    )
    .await;
    let valid_ipn = read_last_ipn(&fixture).await;
    let failed_payment_id =
        read_payment_id(&init_session(&fixture.app_router, &[("tran_id", "SHOP-ORDER-8")]).await);
    complete_checkout(
        &fixture.app_router,
        &failed_payment_id,
        pay_with_card("4000000000000002"),
    )
    .await;
    let failed_ipn = read_last_ipn(&fixture).await;
    let mut altered_ipn = valid_ipn.clone();
    altered_ipn.insert("amount".to_owned(), "1.00".to_owned());

    assert_eq!(valid_ipn["status"], "VALID");
    assert_eq!(valid_ipn["tran_id"], "SHOP-ORDER-7");
    assert_eq!(valid_ipn["amount"], "1250.50");
    assert_eq!(valid_ipn["currency"], "BDT");
    assert_eq!(valid_ipn["value_a"], "cart-42");
    assert_eq!(valid_ipn["card_brand"], "VISA");
    assert!(valid_ipn["val_id"].starts_with("VAL"));
    assert!(has_valid_sign(&valid_ipn));
    assert!(!has_valid_sign(&altered_ipn));
    assert_eq!(failed_ipn["status"], "FAILED");
    assert_eq!(failed_ipn["tran_id"], "SHOP-ORDER-8");
    assert_eq!(failed_ipn["val_id"], "");
    assert!(has_valid_sign(&failed_ipn));
}

// AC: PY-06.3
#[tokio::test]
async fn the_validation_api_answers_as_the_ipn_and_refuses_other_val_ids() {
    let fixture = build_sslcommerz_fixture().await;
    let payment_id = read_payment_id(&init_session(&fixture.app_router, &[]).await);
    complete_checkout(
        &fixture.app_router,
        &payment_id,
        pay_with_card("4242424242424242"),
    )
    .await;
    let valid_ipn = read_last_ipn(&fixture).await;
    let val_id = valid_ipn["val_id"].clone();

    let first_validation = validate_order(&fixture.app_router, &val_id, STORE_PASSWORD).await;
    let second_validation = validate_order(&fixture.app_router, &val_id, STORE_PASSWORD).await;
    let tampered = validate_order(&fixture.app_router, &format!("{val_id}X"), STORE_PASSWORD).await;
    let wrong_password = validate_order(&fixture.app_router, &val_id, "guess").await;
    let without_val_id = validate_order(&fixture.app_router, "", STORE_PASSWORD).await;

    assert_eq!(first_validation["status"], "VALID");
    assert_eq!(first_validation["APIConnect"], "DONE");
    for shared_field in [
        "tran_id",
        "val_id",
        "amount",
        "currency",
        "bank_tran_id",
        "tran_date",
    ] {
        assert_eq!(
            first_validation[shared_field], valid_ipn[shared_field],
            "{shared_field}"
        );
    }
    assert_eq!(second_validation["status"], "VALIDATED");
    assert_eq!(
        second_validation["validated_on"],
        first_validation["validated_on"]
    );
    assert_eq!(tampered["status"], "INVALID_TRANSACTION");
    assert!(tampered.get("tran_id").is_none());
    assert_eq!(wrong_password, json!({"APIConnect": "FAILED"}));
    assert_eq!(without_val_id, json!({"APIConnect": "INVALID_REQUEST"}));
}

// AC: PY-06.3
#[tokio::test]
async fn a_failed_payment_has_no_val_id_to_validate() {
    let fixture = build_sslcommerz_fixture().await;
    let payment_id = read_payment_id(&init_session(&fixture.app_router, &[]).await);
    complete_checkout(
        &fixture.app_router,
        &payment_id,
        pay_with_card("4000000000000002"),
    )
    .await;
    let payment = fixture.read_payment(&payment_id).await;
    let unpaid_val_id = payment["provider_ids"]["val_id"]
        .as_str()
        .unwrap_or_default();

    let validation = validate_order(&fixture.app_router, unpaid_val_id, STORE_PASSWORD).await;

    assert_eq!(payment["status"], "failed");
    assert_eq!(validation["status"], "INVALID_TRANSACTION");
}

// AC: PY-06.4
#[tokio::test]
async fn success_fail_and_cancel_post_the_signed_transaction_to_the_apps_urls() {
    let fixture = build_sslcommerz_fixture().await;
    let paid_id = read_payment_id(&init_session(&fixture.app_router, &[]).await);
    let declined_id = read_payment_id(&init_session(&fixture.app_router, &[]).await);
    let canceled_id = read_payment_id(&init_session(&fixture.app_router, &[]).await);

    let paid = complete_checkout(
        &fixture.app_router,
        &paid_id,
        pay_with_card("4242424242424242"),
    )
    .await;
    let declined = complete_checkout(
        &fixture.app_router,
        &declined_id,
        pay_with_card("4000000000000002"),
    )
    .await;
    let canceled = complete_checkout(
        &fixture.app_router,
        &canceled_id,
        json!({"action": "cancel"}),
    )
    .await;

    let outcomes = [
        (&paid, SUCCESS_URL, "VALID"),
        (&declined, FAIL_URL, "FAILED"),
        (&canceled, CANCEL_URL, "CANCELLED"),
    ];
    for (checkout_session, expected_url, expected_status) in outcomes {
        let redirect_fields = read_redirect_fields(checkout_session);
        assert_eq!(checkout_session["redirect"]["method"], "POST");
        assert_eq!(checkout_session["redirect"]["url"], expected_url);
        assert_eq!(redirect_fields["status"], expected_status);
        assert_eq!(redirect_fields["tran_id"], "SHOP-ORDER-7");
        assert_eq!(redirect_fields["amount"], "1250.50");
        assert!(has_valid_sign(&redirect_fields), "{redirect_fields:?}");
    }
    let paid_fields = read_redirect_fields(&paid);
    let validation =
        validate_order(&fixture.app_router, &paid_fields["val_id"], STORE_PASSWORD).await;
    assert_eq!(validation["status"], "VALID");
    assert_eq!(
        validation["bank_tran_id"],
        paid_fields["bank_tran_id"].as_str()
    );
}
