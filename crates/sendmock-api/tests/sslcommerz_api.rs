#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod payment_notification_fixture;
    pub mod scripted_webhook_sender;
    pub mod sslcommerz_requests;
    pub mod test_app;
}

use serde_json::json;
use support::sslcommerz_requests::{
    CANCEL_URL, FAIL_URL, SSLCOMMERZ_PATH, STORE_ID, STORE_PASSWORD, SUCCESS_URL,
    build_form_request, build_multipart_request, build_sslcommerz_fixture, complete_checkout,
    has_valid_sign, init_session, pay_with_card, read_last_ipn, read_payment_id,
    read_redirect_fields, send_request, validate_order,
};
use support::test_app::call_api;

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

// AC: PY-06.1
#[tokio::test]
async fn session_init_reads_a_multipart_form_as_sslcommerz_lts_posts_it() {
    let fixture = build_sslcommerz_fixture().await;
    let session_request = build_multipart_request(
        &format!("{SSLCOMMERZ_PATH}/gwprocess/v4/api.php"),
        &[
            ("store_id", STORE_ID),
            ("store_passwd", STORE_PASSWORD),
            ("productcategory", "Mugs"),
            ("tran_id", "NODE-ORDER-1"),
            ("total_amount", "450"),
            ("currency", "BDT"),
            ("success_url", SUCCESS_URL),
            ("fail_url", FAIL_URL),
            ("cancel_url", CANCEL_URL),
            ("ipn_url", ""),
            ("multi_card_name", ""),
        ],
    );

    let (status, session) = send_request(fixture.app_router.clone(), session_request).await;

    assert_eq!(status, 200, "{session}");
    assert_eq!(session["status"], "SUCCESS", "{session}");
    let payment = fixture.read_payment(&read_payment_id(&session)).await;
    assert_eq!(payment["provider_reference"], "NODE-ORDER-1");
    assert_eq!(payment["amount_minor"], 45_000);
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
