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
use sendmock_payments::sign_paddle_payload;
use serde_json::{Value, json};
use support::payment_notification_fixture::{NotificationFixture, build_fixture};
use support::scripted_webhook_sender::ScriptedWebhookSender;
use support::sslcommerz_requests::{complete_checkout, pay_with_card, send_request};

const PADDLE_PATH: &str = "/providers/paddle";
const API_KEY: &str = "pdl_sdbx_apikey_sendmock_SendMockPaddleKey01";
const NOTIFICATION_SECRET: &str = "pdl_ntfset_sendmock_SendMockPaddleSecret01";

async fn call_paddle(
    app_router: &axum::Router,
    method: &str,
    api_path: &str,
    body: Option<&Value>,
    api_key: &str,
) -> (u16, Value) {
    let request = Request::builder()
        .method(method)
        .uri(format!("{PADDLE_PATH}{api_path}"))
        .header("authorization", format!("Bearer {api_key}"))
        .header("content-type", "application/json")
        .body(body.map_or_else(Body::empty, |body| Body::from(body.to_string())))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    send_request(app_router.clone(), request).await
}

fn transaction_body() -> Value {
    json!({
        "items": [{
            "quantity": 2,
            "price": {
                "description": "Monthly seat", "name": "Seat",
                "unit_price": { "amount": "1500", "currency_code": "USD" },
                "product": { "name": "Team plan", "tax_category": "standard" },
            },
        }],
        "custom_data": { "account": "acme" },
    })
}

async fn create_transaction(app_router: &axum::Router) -> Value {
    let (status, created) = call_paddle(
        app_router,
        "POST",
        "/transactions",
        Some(&transaction_body()),
        API_KEY,
    )
    .await;
    assert_eq!(status, 201, "{created}");
    created["data"].clone()
}

fn read_checkout_id(transaction: &Value) -> String {
    transaction["checkout"]["url"]
        .as_str()
        .and_then(|page_url| page_url.rsplit('/').next())
        .unwrap_or_default()
        .to_owned()
}

async fn create_and_pay(fixture: &NotificationFixture, card_number: &str) -> Value {
    let transaction = create_transaction(&fixture.app_router).await;
    complete_checkout(
        &fixture.app_router,
        &read_checkout_id(&transaction),
        pay_with_card(card_number),
    )
    .await;
    transaction
}

/// The notifications sent with this `event_type`, each with whether its `Paddle-Signature`
/// verifies with the notification secret.
fn find_notifications(fixture: &NotificationFixture, event_type: &str) -> Vec<(Value, bool)> {
    fixture
        .sent_requests()
        .into_iter()
        .filter_map(|sent_request| {
            let notification: Value = serde_json::from_str(&sent_request.body).ok()?;
            (notification["event_type"] == event_type).then_some(())?;
            let signature = sent_request
                .headers
                .get("paddle-signature")
                .cloned()
                .unwrap_or_default();
            let timestamp_seconds = signature
                .split(';')
                .find_map(|signature_part| signature_part.strip_prefix("ts="))
                .and_then(|timestamp_text| timestamp_text.parse::<i64>().ok())
                .unwrap_or_default();
            let is_genuine =
                sign_paddle_payload(NOTIFICATION_SECRET, timestamp_seconds, &sent_request.body)
                    == signature;
            Some((notification, is_genuine))
        })
        .collect()
}

async fn build_paddle_fixture() -> NotificationFixture {
    build_fixture(ScriptedWebhookSender::default(), &["paddle"]).await
}

// AC: PY-10.3
#[tokio::test]
async fn a_transaction_is_created_from_non_catalog_items_with_a_checkout_url() {
    let fixture = build_paddle_fixture().await;

    let transaction = create_transaction(&fixture.app_router).await;

    assert!(
        transaction["id"]
            .as_str()
            .is_some_and(|transaction_id| transaction_id.starts_with("txn_")),
        "{transaction}"
    );
    assert_eq!(transaction["status"], "ready");
    assert_eq!(transaction["details"]["totals"]["total"], "3000");
    assert_eq!(
        transaction["items"][0]["price"]["unit_price"]["amount"],
        "1500"
    );
    assert_eq!(transaction["custom_data"]["account"], "acme");
    assert!(!read_checkout_id(&transaction).is_empty());
}

// AC: PY-10.3
#[tokio::test]
async fn bad_keys_catalog_prices_and_unknown_ids_are_refused_in_paddles_envelope() {
    let fixture = build_paddle_fixture().await;

    let (missing_status, missing_key) = call_paddle(
        &fixture.app_router,
        "POST",
        "/transactions",
        Some(&transaction_body()),
        "",
    )
    .await;
    let (wrong_status, _) = call_paddle(
        &fixture.app_router,
        "POST",
        "/transactions",
        Some(&transaction_body()),
        "pdl_wrong",
    )
    .await;
    let catalog_item = json!({ "items": [{ "price_id": "pri_01", "quantity": 1 }] });
    let (catalog_status, catalog) = call_paddle(
        &fixture.app_router,
        "POST",
        "/transactions",
        Some(&catalog_item),
        API_KEY,
    )
    .await;
    let (unknown_status, unknown) = call_paddle(
        &fixture.app_router,
        "GET",
        "/transactions/txn_missing",
        None,
        API_KEY,
    )
    .await;

    assert_eq!(missing_status, 401);
    assert_eq!(missing_key["error"]["code"], "authentication_missing");
    assert_eq!(wrong_status, 403);
    assert_eq!(catalog_status, 400);
    assert_eq!(catalog["error"]["code"], "invalid_field");
    assert_eq!(unknown_status, 404);
    assert_eq!(unknown["error"]["type"], "request_error");
    assert!(unknown["meta"]["request_id"].is_string());
}

// AC: PY-10.3
#[tokio::test]
async fn a_paid_transaction_completes_and_sends_signed_notifications() {
    let fixture = build_paddle_fixture().await;

    let transaction = create_and_pay(&fixture, "4242424242424242").await;
    fixture.run_due().await;

    let transaction_id = transaction["id"].as_str().unwrap_or_default();
    let (_, fetched) = call_paddle(
        &fixture.app_router,
        "GET",
        &format!("/transactions/{transaction_id}"),
        None,
        API_KEY,
    )
    .await;
    assert_eq!(fetched["data"]["status"], "completed");
    assert_eq!(fetched["data"]["payments"][0]["status"], "captured");
    let completed = find_notifications(&fixture, "transaction.completed");
    let paid = find_notifications(&fixture, "transaction.paid");
    assert_eq!(completed.len(), 1, "{completed:?}");
    assert!(completed[0].1, "Paddle-Signature verifies");
    assert_eq!(completed[0].0["data"]["id"], transaction_id);
    assert!(
        completed[0].0["notification_id"]
            .as_str()
            .is_some_and(|notification_id| notification_id.starts_with("ntf_"))
    );
    assert_eq!(paid[0].0["data"]["status"], "paid");
}

// AC: PY-10.3
#[tokio::test]
async fn a_declined_card_sends_payment_failed_with_the_attempt() {
    let fixture = build_paddle_fixture().await;

    create_and_pay(&fixture, "4000000000000002").await;
    fixture.run_due().await;

    let failed = find_notifications(&fixture, "transaction.payment_failed");
    assert_eq!(failed.len(), 1);
    assert!(failed[0].1);
    assert_eq!(failed[0].0["data"]["payments"][0]["status"], "error");
}

// AC: PY-10.3
#[tokio::test]
async fn refunds_are_adjustments_in_part_then_in_full() {
    let fixture = build_paddle_fixture().await;
    let transaction = create_and_pay(&fixture, "4242424242424242").await;
    let transaction_id = transaction["id"].as_str().unwrap_or_default();
    let refund_item = |amount: &str| {
        json!({ "action": "refund", "transaction_id": transaction_id, "reason": "Too many seats",
                "items": [{ "item_id": "txnitm_01", "type": "partial", "amount": amount }] })
    };

    let (status, partial) = call_paddle(
        &fixture.app_router,
        "POST",
        "/adjustments",
        Some(&refund_item("1000")),
        API_KEY,
    )
    .await;
    let (too_much_status, too_much) = call_paddle(
        &fixture.app_router,
        "POST",
        "/adjustments",
        Some(&refund_item("5000")),
        API_KEY,
    )
    .await;
    let full_refund = json!({ "action": "refund", "type": "full", "transaction_id": transaction_id, "reason": "Closed" });
    let (_, full) = call_paddle(
        &fixture.app_router,
        "POST",
        "/adjustments",
        Some(&full_refund),
        API_KEY,
    )
    .await;
    fixture.run_due().await;
    fixture.run_due().await;

    assert_eq!(status, 201, "{partial}");
    assert_eq!(partial["data"]["action"], "refund");
    assert_eq!(partial["data"]["status"], "approved");
    assert_eq!(partial["data"]["totals"]["total"], "1000");
    assert_eq!(too_much_status, 400, "{too_much}");
    assert_eq!(full["data"]["totals"]["total"], "2000");
    let adjustments = find_notifications(&fixture, "adjustment.created");
    assert_eq!(adjustments.len(), 2, "{adjustments:?}");
    assert!(adjustments.iter().all(|(_, is_genuine)| *is_genuine));
    assert_eq!(adjustments[0].0["data"]["transaction_id"], transaction_id);
}
