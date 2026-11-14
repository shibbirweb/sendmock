#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod payment_notification_fixture;
    pub mod scripted_webhook_sender;
    pub mod sslcommerz_requests;
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use serde_json::{Value, json};
use support::payment_notification_fixture::{NotificationFixture, build_fixture};
use support::scripted_webhook_sender::ScriptedWebhookSender;
use support::sslcommerz_requests::{complete_checkout, read_redirect_fields, send_request};

const CHECKOUT_PATH: &str = "/providers/bkash/v1.2.0-beta/tokenized/checkout";
const APP_KEY: &str = "sendmock-bkash-app-key";
const APP_SECRET: &str = "sendmock-bkash-app-secret";
const USERNAME: &str = "sandboxTokenizedUser02";
const PASSWORD: &str = "sandboxTokenizedUser02@12345";
const CALLBACK_URL: &str = "https://shop.example/bkash/callback";

/// A JSON call as bKash's documented samples make it: the token calls with the merchant's
/// username and password, the others with the id token and the app key.
async fn call_bkash(
    app_router: &axum::Router,
    api_path: &str,
    headers: &[(&str, &str)],
    body: &Value,
) -> Value {
    let mut request_builder = Request::builder()
        .method("POST")
        .uri(format!("{CHECKOUT_PATH}/{api_path}"))
        .header("content-type", "application/json")
        .header("accept", "application/json");
    for (header_name, header_value) in headers {
        request_builder = request_builder.header(*header_name, *header_value);
    }
    let request = request_builder
        .body(Body::from(body.to_string()))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let (status, answer) = send_request(app_router.clone(), request).await;
    assert_eq!(status, 200, "{answer}");
    answer
}

async fn grant_token(app_router: &axum::Router, password: &str, app_secret: &str) -> Value {
    call_bkash(
        app_router,
        "token/grant",
        &[("username", USERNAME), ("password", password)],
        &json!({ "app_key": APP_KEY, "app_secret": app_secret }),
    )
    .await
}

async fn call_with_token(app_router: &axum::Router, api_path: &str, body: &Value) -> Value {
    let token = grant_token(app_router, PASSWORD, APP_SECRET).await;
    let id_token = token["id_token"].as_str().unwrap_or_default().to_owned();
    call_bkash(
        app_router,
        api_path,
        &[("authorization", &id_token), ("x-app-key", APP_KEY)],
        body,
    )
    .await
}

fn create_body(changed_fields: &Value) -> Value {
    let mut create_fields = json!({
        "mode": "0011", "payerReference": "01619777283", "callbackURL": CALLBACK_URL,
        "amount": "500", "currency": "BDT", "intent": "sale", "merchantInvoiceNumber": "Inv0124",
    });
    if let (Some(fields), Some(changes)) =
        (create_fields.as_object_mut(), changed_fields.as_object())
    {
        fields.extend(changes.clone());
    }
    create_fields
}

fn read_checkout_id(created: &Value) -> String {
    created["bkashURL"]
        .as_str()
        .and_then(|page_url| page_url.rsplit('/').next())
        .unwrap_or_default()
        .to_owned()
}

fn pay_with_wallet(wallet_number: &str) -> Value {
    json!({
        "action": "pay", "method_key": "bkash",
        "entries": { "number": wallet_number, "otp": "123456", "pin": "12121" },
    })
}

/// A payment created through the API and paid on the checkout page with the wallet.
async fn create_and_pay(fixture: &NotificationFixture, wallet_number: &str) -> (Value, Value) {
    let created = call_with_token(&fixture.app_router, "create", &create_body(&json!({}))).await;
    let session = complete_checkout(
        &fixture.app_router,
        &read_checkout_id(&created),
        pay_with_wallet(wallet_number),
    )
    .await;
    (created, session)
}

fn payment_id_body(created: &Value) -> Value {
    json!({ "paymentID": created["paymentID"] })
}

// AC: PY-10.1
#[tokio::test]
async fn grant_token_checks_the_merchant_login_and_the_app_secret() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), &["bkash"]).await;

    let granted = grant_token(&fixture.app_router, PASSWORD, APP_SECRET).await;
    let wrong_password = grant_token(&fixture.app_router, "guess", APP_SECRET).await;
    let wrong_secret = grant_token(&fixture.app_router, PASSWORD, "guess").await;
    let refreshed = call_bkash(
        &fixture.app_router,
        "token/refresh",
        &[("username", USERNAME), ("password", PASSWORD)],
        &json!({ "app_key": APP_KEY, "app_secret": APP_SECRET, "refresh_token": granted["refresh_token"] }),
    )
    .await;

    assert_eq!(granted["statusCode"], "0000", "{granted}");
    assert_eq!(granted["token_type"], "Bearer");
    assert_eq!(granted["expires_in"], 3600);
    assert!(
        granted["id_token"]
            .as_str()
            .is_some_and(|id_token| !id_token.is_empty())
    );
    assert_eq!(wrong_password["statusCode"], "4001");
    assert_eq!(wrong_secret["statusCode"], "2001");
    assert_eq!(refreshed["statusCode"], "0000", "{refreshed}");
}

// AC: PY-10.1
#[tokio::test]
async fn create_answers_the_checkout_page_and_callback_urls_and_refuses_bad_fields() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), &["bkash"]).await;

    let created = call_with_token(&fixture.app_router, "create", &create_body(&json!({}))).await;
    let in_dollars = call_with_token(
        &fixture.app_router,
        "create",
        &create_body(&json!({ "currency": "USD" })),
    )
    .await;
    let without_app_key = call_bkash(
        &fixture.app_router,
        "create",
        &[("authorization", "token")],
        &create_body(&json!({})),
    )
    .await;

    assert_eq!(created["statusCode"], "0000", "{created}");
    assert_eq!(created["transactionStatus"], "Initiated");
    assert_eq!(created["amount"], "500.00");
    assert_eq!(created["merchantInvoiceNumber"], "Inv0124");
    let payment_id = created["paymentID"].as_str().unwrap_or_default();
    assert!(payment_id.starts_with("TR00"), "{created}");
    assert_eq!(
        created["successCallbackURL"],
        format!("{CALLBACK_URL}?paymentID={payment_id}&status=success")
    );
    assert_eq!(
        created["cancelledCallbackURL"],
        format!("{CALLBACK_URL}?paymentID={payment_id}&status=cancel")
    );
    let payment = fixture.read_payment(&read_checkout_id(&created)).await;
    assert_eq!(payment["provider_reference"], payment_id);
    assert_eq!(payment["amount_minor"], 50_000);
    assert_eq!(in_dollars["statusCode"], "2007");
    assert_eq!(without_app_key["statusCode"], "2001");
}

// AC: PY-10.1
#[tokio::test]
async fn a_paid_payment_calls_back_executes_once_and_answers_its_status() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), &["bkash"]).await;
    let created = call_with_token(&fixture.app_router, "create", &create_body(&json!({}))).await;
    let before_paying =
        call_with_token(&fixture.app_router, "execute", &payment_id_body(&created)).await;

    let session = complete_checkout(
        &fixture.app_router,
        &read_checkout_id(&created),
        pay_with_wallet("01770000001"),
    )
    .await;
    let executed =
        call_with_token(&fixture.app_router, "execute", &payment_id_body(&created)).await;
    let executed_again =
        call_with_token(&fixture.app_router, "execute", &payment_id_body(&created)).await;
    let queried = call_with_token(
        &fixture.app_router,
        "payment/status",
        &payment_id_body(&created),
    )
    .await;

    assert_eq!(before_paying["statusCode"], "2056");
    assert_eq!(session["redirect"]["url"], CALLBACK_URL);
    let redirect_fields = read_redirect_fields(&session);
    assert_eq!(
        redirect_fields.get("status").map(String::as_str),
        Some("success")
    );
    assert_eq!(
        redirect_fields.get("paymentID"),
        created["paymentID"].as_str().map(str::to_owned).as_ref()
    );
    assert_eq!(executed["statusCode"], "0000", "{executed}");
    assert_eq!(executed["transactionStatus"], "Completed");
    assert_eq!(executed["customerMsisdn"], "01770****01");
    assert!(
        executed["trxID"]
            .as_str()
            .is_some_and(|trx_id| trx_id.starts_with("TRX"))
    );
    assert_eq!(executed_again["statusCode"], "2062");
    assert_eq!(queried["transactionStatus"], "Completed");
    assert_eq!(queried["trxID"], executed["trxID"]);
}

// AC: PY-10.1
#[tokio::test]
async fn a_wallet_short_of_balance_fails_execute_and_a_canceled_checkout_calls_back_cancel() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), &["bkash"]).await;
    let (declined, declined_session) = create_and_pay(&fixture, "01770000002").await;
    let canceled = call_with_token(&fixture.app_router, "create", &create_body(&json!({}))).await;

    let executed =
        call_with_token(&fixture.app_router, "execute", &payment_id_body(&declined)).await;
    let queried = call_with_token(
        &fixture.app_router,
        "payment/status",
        &payment_id_body(&declined),
    )
    .await;
    let canceled_session = complete_checkout(
        &fixture.app_router,
        &read_checkout_id(&canceled),
        json!({ "action": "cancel" }),
    )
    .await;

    assert_eq!(
        read_redirect_fields(&declined_session)
            .get("status")
            .map(String::as_str),
        Some("failure")
    );
    assert_eq!(executed["statusCode"], "2023", "{executed}");
    assert_eq!(queried["transactionStatus"], "Failed");
    assert_eq!(
        read_redirect_fields(&canceled_session)
            .get("status")
            .map(String::as_str),
        Some("cancel")
    );
}

// AC: PY-10.1
#[tokio::test]
async fn an_executed_payment_refunds_in_part_and_answers_the_refund_status() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), &["bkash"]).await;
    let (created, _) = create_and_pay(&fixture, "01770000001").await;
    let executed =
        call_with_token(&fixture.app_router, "execute", &payment_id_body(&created)).await;
    let refund_body = |amount: &str| json!({ "paymentID": created["paymentID"], "trxID": executed["trxID"], "amount": amount, "sku": "mug", "reason": "Broken" });

    let refunded =
        call_with_token(&fixture.app_router, "payment/refund", &refund_body("200")).await;
    let too_much =
        call_with_token(&fixture.app_router, "payment/refund", &refund_body("400")).await;
    let refund_status = call_with_token(
        &fixture.app_router,
        "payment/refund",
        &json!({ "paymentID": created["paymentID"], "trxID": executed["trxID"] }),
    )
    .await;

    assert_eq!(refunded["statusCode"], "0000", "{refunded}");
    assert_eq!(refunded["transactionStatus"], "Completed");
    assert_eq!(refunded["originalTrxID"], executed["trxID"]);
    assert_eq!(refunded["amount"], "200.00");
    assert_eq!(too_much["statusCode"], "2072");
    assert_eq!(refund_status["refundTrxID"], refunded["refundTrxID"]);
    let payment = fixture.read_payment(&read_checkout_id(&created)).await;
    assert_eq!(payment["status"], "partially_refunded");
    assert_eq!(payment["refunded_minor"], 20_000);
}

// AC: PY-10.1
#[tokio::test]
async fn the_payment_notification_carries_the_payment_and_trx_ids() {
    let fixture = build_fixture(ScriptedWebhookSender::default(), &["bkash"]).await;

    let (created, _) = create_and_pay(&fixture, "01770000001").await;
    fixture.run_due().await;

    let sent_bodies: Vec<String> = fixture
        .sent_requests()
        .into_iter()
        .map(|sent_request| sent_request.body)
        .collect();
    let callback_body = sent_bodies
        .iter()
        .find(|sent_body| sent_body.contains("\"success\""))
        .cloned()
        .unwrap_or_default();
    let callback: Value = serde_json::from_str(&callback_body).unwrap_or(Value::Null);
    assert_eq!(
        callback["paymentID"], created["paymentID"],
        "{sent_bodies:?}"
    );
    assert_eq!(callback["transactionStatus"], "success");
    assert_eq!(callback["amount"], "500.00");
}
