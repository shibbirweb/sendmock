#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod payment_notification_fixture;
    pub mod scripted_webhook_sender;
    pub mod sslcommerz_requests;
    pub mod test_app;
}

use std::collections::BTreeMap;

use serde_json::{Value, json};
use support::payment_notification_fixture::NotificationFixture;
use support::sslcommerz_requests::{
    STORE_PASSWORD, build_sslcommerz_fixture, call_merchant_api, complete_checkout, has_valid_sign,
    init_session, pay_with_card, read_last_ipn, read_payment_id, validate_order,
};

/// A paid SSLCommerz checkout of 1250.50 BDT: its payment id and the IPN it sent.
async fn pay_session(fixture: &NotificationFixture) -> (String, BTreeMap<String, String>) {
    let payment_id = read_payment_id(&init_session(&fixture.app_router, &[]).await);
    complete_checkout(
        &fixture.app_router,
        &payment_id,
        pay_with_card("4242424242424242"),
    )
    .await;
    (payment_id, read_last_ipn(fixture).await)
}

async fn refund(fixture: &NotificationFixture, bank_tran_id: &str, refund_amount: &str) -> Value {
    call_merchant_api(
        &fixture.app_router,
        &[
            ("bank_tran_id", bank_tran_id),
            ("refund_amount", refund_amount),
            ("refund_remarks", "Customer returned the mug"),
            ("refe_id", "RET-7"),
        ],
    )
    .await
}

fn read_text(json_value: &Value) -> String {
    json_value.as_str().unwrap_or_default().to_owned()
}

// AC: PY-06.5
#[tokio::test]
async fn a_partial_then_full_refund_answers_refund_ids_and_sends_refunded_ipns() {
    let fixture = build_sslcommerz_fixture().await;
    let (payment_id, valid_ipn) = pay_session(&fixture).await;
    let bank_tran_id = valid_ipn["bank_tran_id"].clone();

    let partial_refund = refund(&fixture, &bank_tran_id, "250.50").await;
    let partial_ipn = read_last_ipn(&fixture).await;
    let partly_refunded = fixture.read_payment(&payment_id).await;
    let full_refund = refund(&fixture, &bank_tran_id, "1000").await;
    let refunded = fixture.read_payment(&payment_id).await;

    assert_eq!(partial_refund["APIConnect"], "DONE");
    assert_eq!(partial_refund["status"], "success");
    assert_eq!(partial_refund["errorReason"], "");
    assert_eq!(partial_refund["bank_tran_id"], bank_tran_id.as_str());
    assert_eq!(partial_refund["trans_id"], "SHOP-ORDER-7");
    assert_eq!(read_text(&partial_refund["refund_ref_id"]).len(), 13);
    assert_ne!(
        partial_refund["refund_ref_id"],
        full_refund["refund_ref_id"]
    );
    assert_eq!(partly_refunded["status"], "partially_refunded");
    assert_eq!(partly_refunded["refunded_minor"], 25_050);
    assert_eq!(partial_ipn["status"], "REFUNDED");
    assert_eq!(partial_ipn["val_id"], valid_ipn["val_id"]);
    assert!(has_valid_sign(&partial_ipn));
    assert_eq!(full_refund["status"], "success");
    assert_eq!(refunded["status"], "refunded");
}

// AC: PY-06.5
#[tokio::test]
async fn refunds_sslcommerz_would_refuse_answer_failed_with_a_reason() {
    let fixture = build_sslcommerz_fixture().await;
    let (_, valid_ipn) = pay_session(&fixture).await;
    let bank_tran_id = valid_ipn["bank_tran_id"].clone();

    let too_much = refund(&fixture, &bank_tran_id, "1250.51").await;
    let bad_amount = refund(&fixture, &bank_tran_id, "ten").await;
    let unknown = refund(&fixture, "BTXUNKNOWN", "10.00").await;
    refund(&fixture, &bank_tran_id, "1250.50").await;
    let after_full_refund = refund(&fixture, &bank_tran_id, "1.00").await;
    let without_remarks = call_merchant_api(
        &fixture.app_router,
        &[
            ("bank_tran_id", bank_tran_id.as_str()),
            ("refund_amount", "1.00"),
        ],
    )
    .await;

    assert_eq!(
        too_much["errorReason"],
        "Refund amount exceeds the refundable amount"
    );
    assert_eq!(bad_amount["errorReason"], "Invalid refund amount");
    assert_eq!(unknown["errorReason"], "Invalid bank_tran_id");
    assert_eq!(
        after_full_refund["errorReason"],
        "The transaction is not refundable"
    );
    for refused_refund in [&too_much, &bad_amount, &unknown, &after_full_refund] {
        assert_eq!(refused_refund["APIConnect"], "DONE");
        assert_eq!(refused_refund["status"], "failed");
        assert_eq!(refused_refund["refund_ref_id"], "");
    }
    assert_eq!(without_remarks, json!({"APIConnect": "INVALID_REQUEST"}));
}

// AC: PY-06.5
#[tokio::test]
async fn the_refund_status_is_queried_by_its_refund_ref_id() {
    let fixture = build_sslcommerz_fixture().await;
    let (_, valid_ipn) = pay_session(&fixture).await;
    let started_refund = refund(&fixture, &valid_ipn["bank_tran_id"], "100.00").await;
    let refund_ref_id = read_text(&started_refund["refund_ref_id"]);

    let refund_status =
        call_merchant_api(&fixture.app_router, &[("refund_ref_id", &refund_ref_id)]).await;
    let unknown_status =
        call_merchant_api(&fixture.app_router, &[("refund_ref_id", "0000000000000")]).await;

    assert_eq!(refund_status["APIConnect"], "DONE");
    assert_eq!(refund_status["status"], "refunded");
    assert_eq!(refund_status["refund_ref_id"], refund_ref_id.as_str());
    assert_eq!(
        refund_status["bank_tran_id"],
        valid_ipn["bank_tran_id"].as_str()
    );
    assert_eq!(refund_status["tran_id"], "SHOP-ORDER-7");
    assert!(refund_status["initiated_on"].is_string());
    assert_eq!(refund_status["refunded_on"], refund_status["initiated_on"]);
    assert_eq!(unknown_status["status"], "failed");
}

// AC: PY-06.5
#[tokio::test]
async fn the_transaction_query_answers_by_session_key_and_by_tran_id() {
    let fixture = build_sslcommerz_fixture().await;
    let pending_session = init_session(&fixture.app_router, &[("tran_id", "SHOP-ORDER-9")]).await;
    let pending_key = read_text(&pending_session["sessionkey"]);
    let pending = call_merchant_api(&fixture.app_router, &[("sessionkey", &pending_key)]).await;
    let paid_session = init_session(&fixture.app_router, &[]).await;
    let paid_key = read_text(&paid_session["sessionkey"]);
    complete_checkout(
        &fixture.app_router,
        &read_payment_id(&paid_session),
        pay_with_card("4242424242424242"),
    )
    .await;
    let valid_ipn = read_last_ipn(&fixture).await;

    let paid = call_merchant_api(&fixture.app_router, &[("sessionkey", &paid_key)]).await;
    validate_order(&fixture.app_router, &valid_ipn["val_id"], STORE_PASSWORD).await;
    let validated = call_merchant_api(&fixture.app_router, &[("sessionkey", &paid_key)]).await;
    let by_tran_id = call_merchant_api(&fixture.app_router, &[("tran_id", "SHOP-ORDER-7")]).await;
    let unknown_tran_id = call_merchant_api(&fixture.app_router, &[("tran_id", "NOPE")]).await;
    let unknown_key = call_merchant_api(&fixture.app_router, &[("sessionkey", "NOPE")]).await;

    assert_eq!(pending["status"], "PENDING");
    assert_eq!(pending["tran_id"], "SHOP-ORDER-9");
    assert_eq!(pending["val_id"], "");
    assert_eq!(paid["status"], "VALID");
    assert_eq!(paid["sessionkey"], paid_key.as_str());
    assert_eq!(paid["APIConnect"], "DONE");
    for shared_field in ["tran_id", "val_id", "amount", "bank_tran_id", "tran_date"] {
        assert_eq!(
            paid[shared_field],
            valid_ipn[shared_field].as_str(),
            "{shared_field}"
        );
    }
    assert_eq!(validated["status"], "VALIDATED");
    assert!(!read_text(&validated["validated_on"]).is_empty());
    assert_eq!(by_tran_id["APIConnect"], "DONE");
    assert_eq!(by_tran_id["no_of_trans_found"], 1);
    assert_eq!(by_tran_id["element"][0]["status"], "VALIDATED");
    assert_eq!(
        by_tran_id["element"][0]["val_id"],
        valid_ipn["val_id"].as_str()
    );
    assert_eq!(unknown_tran_id["no_of_trans_found"], 0);
    assert_eq!(unknown_tran_id["element"], json!([]));
    assert_eq!(unknown_key["status"], "INVALID_TRANSACTION");
}

// AC: PY-06.5
#[tokio::test]
async fn the_merchant_api_refuses_wrong_credentials_and_requests_it_cannot_tell() {
    let fixture = build_sslcommerz_fixture().await;
    let (payment_id, valid_ipn) = pay_session(&fixture).await;

    let wrong_password = call_merchant_api(
        &fixture.app_router,
        &[
            ("store_passwd", "guess"),
            ("bank_tran_id", valid_ipn["bank_tran_id"].as_str()),
            ("refund_amount", "1.00"),
            ("refund_remarks", "Test"),
        ],
    )
    .await;
    let without_fields = call_merchant_api(&fixture.app_router, &[]).await;
    let payment = fixture.read_payment(&payment_id).await;

    assert_eq!(wrong_password, json!({"APIConnect": "FAILED"}));
    assert_eq!(without_fields, json!({"APIConnect": "INVALID_REQUEST"}));
    assert_eq!(payment["status"], "succeeded");
    assert_eq!(payment["refunded_minor"], 0);
}
