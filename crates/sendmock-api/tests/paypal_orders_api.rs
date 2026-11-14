#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod paypal_requests;
    pub mod test_app;
}

use axum::http::Request;
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde_json::json;
use support::paypal_requests::{
    PAYPAL_PATH, act_on_page, call_paypal, create_order, find_link, read_issue, read_text,
    send_paypal_request,
};
use support::test_app::{build_test_app, call_api};

// AC: PY-05.1
#[tokio::test]
async fn any_client_id_and_secret_get_a_bearer_token() {
    let (app_router, _) = build_test_app();
    let basic_pair = STANDARD.encode("AZshopClient:EKshopSecret");
    let token_request = |authorization: Option<String>, grant_body: &str| {
        let mut request_builder = Request::builder()
            .method("POST")
            .uri(format!("{PAYPAL_PATH}/v1/oauth2/token"))
            .header("content-type", "application/x-www-form-urlencoded");
        if let Some(authorization) = authorization {
            request_builder = request_builder.header("authorization", authorization);
        }
        send_paypal_request(&app_router, request_builder, grant_body.to_owned())
    };

    let issued = token_request(
        Some(format!("Basic {basic_pair}")),
        "grant_type=client_credentials",
    )
    .await;
    let anonymous = token_request(None, "grant_type=client_credentials").await;
    let wrong_grant =
        token_request(Some(format!("Basic {basic_pair}")), "grant_type=password").await;

    assert_eq!(issued.status, 200, "{}", issued.body);
    assert!(read_text(&issued.body["access_token"]).starts_with("A21AA"));
    assert_eq!(issued.body["token_type"], "Bearer");
    assert_eq!(issued.body["expires_in"], 32_400);
    assert_eq!(anonymous.status, 401);
    assert_eq!(anonymous.body["error"], "invalid_client");
    assert_eq!(wrong_grant.status, 400);
    assert_eq!(wrong_grant.body["error"], "unsupported_grant_type");
}

// AC: PY-05.1
#[tokio::test]
async fn an_order_waits_for_the_payer_on_the_checkout_page() {
    let (app_router, _) = build_test_app();

    let created = create_order(&app_router).await;
    let order_id = read_text(&created.body["id"]);
    let early_capture = call_paypal(
        &app_router,
        "POST",
        &format!("/v2/checkout/orders/{order_id}/capture"),
        None,
    )
    .await;

    assert_eq!(created.status, 201, "{}", created.body);
    assert!(created.debug_id.is_some());
    assert_eq!(created.body["intent"], "CAPTURE");
    assert_eq!(created.body["status"], "PAYER_ACTION_REQUIRED");
    assert_eq!(created.body["purchase_units"][0]["reference_id"], "order-7");
    assert_eq!(
        created.body["purchase_units"][0]["amount"]["value"],
        "25.00"
    );
    assert!(
        find_link(&created.body, "payer-action").is_some_and(|page_url| page_url.contains("/pay/"))
    );
    assert!(find_link(&created.body, "capture").is_some());
    assert_eq!(early_capture.status, 422);
    assert_eq!(read_issue(&early_capture), "ORDER_NOT_APPROVED");
    assert_eq!(early_capture.body["name"], "UNPROCESSABLE_ENTITY");
    assert_eq!(
        early_capture.body["debug_id"],
        json!(early_capture.debug_id)
    );
}

// AC: PY-05.1
#[tokio::test]
async fn an_approved_order_is_captured_once_with_its_capture() {
    let (app_router, _) = build_test_app();
    let created = create_order(&app_router).await;
    let order_id = read_text(&created.body["id"]);

    let approval = act_on_page(&app_router, &created.body, "pay").await;
    let approved = call_paypal(
        &app_router,
        "GET",
        &format!("/v2/checkout/orders/{order_id}"),
        None,
    )
    .await;
    let capture_path = format!("/v2/checkout/orders/{order_id}/capture");
    let captured = call_paypal(&app_router, "POST", &capture_path, None).await;
    let captured_again = call_paypal(&app_router, "POST", &capture_path, None).await;

    assert_eq!(approval["redirect"]["fields"]["token"], order_id.as_str());
    assert_eq!(approval["redirect"]["fields"]["PayerID"], "TESTPAYER01");
    assert_eq!(approved.body["status"], "APPROVED");
    assert_eq!(approved.body["payer"]["payer_id"], "TESTPAYER01");
    assert_eq!(captured.status, 201, "{}", captured.body);
    assert_eq!(captured.body["status"], "COMPLETED");
    let capture = &captured.body["purchase_units"][0]["payments"]["captures"][0];
    assert_eq!(capture["status"], "COMPLETED");
    assert_eq!(
        capture["amount"],
        json!({"currency_code": "USD", "value": "25.00"})
    );
    assert_eq!(capture["invoice_id"], "INV-7");
    assert_eq!(read_text(&capture["id"]).len(), 17);
    assert_eq!(
        capture["seller_receivable_breakdown"]["net_amount"]["value"],
        "23.63"
    );
    assert_eq!(captured_again.status, 422);
    assert_eq!(read_issue(&captured_again), "ORDER_ALREADY_CAPTURED");
    let (_, payments) =
        call_api(&app_router, "GET", "/api/v1/payments?provider=paypal", None).await;
    assert_eq!(payments["items"][0]["status"], "succeeded");
}

// AC: PY-05.1
#[tokio::test]
async fn a_decline_on_the_page_shows_as_instrument_declined_at_capture() {
    let (app_router, _) = build_test_app();
    let created = create_order(&app_router).await;
    let order_id = read_text(&created.body["id"]);

    let declined_page = act_on_page(&app_router, &created.body, "decline").await;
    let capture = call_paypal(
        &app_router,
        "POST",
        &format!("/v2/checkout/orders/{order_id}/capture"),
        None,
    )
    .await;

    assert_eq!(
        declined_page["redirect"]["url"],
        "https://shop.example/paypal/return"
    );
    assert_eq!(
        declined_page["redirect"]["fields"]["token"],
        order_id.as_str()
    );
    assert!(declined_page["redirect"]["fields"].get("PayerID").is_none());
    assert_eq!(capture.status, 422, "{}", capture.body);
    assert_eq!(read_issue(&capture), "INSTRUMENT_DECLINED");
}

/// An order approved and captured; answers its id and the capture's.
async fn capture_new_order(app_router: &axum::Router) -> (String, String) {
    let created = create_order(app_router).await;
    let order_id = read_text(&created.body["id"]);
    act_on_page(app_router, &created.body, "pay").await;
    let captured = call_paypal(
        app_router,
        "POST",
        &format!("/v2/checkout/orders/{order_id}/capture"),
        None,
    )
    .await;
    let capture_id =
        read_text(&captured.body["purchase_units"][0]["payments"]["captures"][0]["id"]);
    (order_id, capture_id)
}

fn refund_amount(value: &str) -> serde_json::Value {
    json!({"amount": {"currency_code": "USD", "value": value}, "note_to_payer": "Sorry"})
}

// AC: PY-05.1
#[tokio::test]
async fn a_partial_refund_leaves_the_capture_partly_refunded_and_more_than_is_left_is_refused() {
    let (app_router, _) = build_test_app();
    let (_, capture_id) = capture_new_order(&app_router).await;
    let refund_path = format!("/v2/payments/captures/{capture_id}/refund");

    let partial = call_paypal(
        &app_router,
        "POST",
        &refund_path,
        Some(&refund_amount("5.00")),
    )
    .await;
    let too_much = call_paypal(
        &app_router,
        "POST",
        &refund_path,
        Some(&refund_amount("30.00")),
    )
    .await;
    let capture_path = format!("/v2/payments/captures/{capture_id}");
    let capture_after = call_paypal(&app_router, "GET", &capture_path, None).await;
    let refund_path_by_id = format!("/v2/payments/refunds/{}", read_text(&partial.body["id"]));
    let retrieved_refund = call_paypal(&app_router, "GET", &refund_path_by_id, None).await;

    assert_eq!(partial.status, 201, "{}", partial.body);
    assert_eq!(partial.body["status"], "COMPLETED");
    assert_eq!(partial.body["amount"]["value"], "5.00");
    assert_eq!(partial.body["note_to_payer"], "Sorry");
    assert_eq!(too_much.status, 422);
    assert_eq!(read_issue(&too_much), "REFUND_AMOUNT_EXCEEDED");
    assert_eq!(capture_after.body["status"], "PARTIALLY_REFUNDED");
    assert_eq!(retrieved_refund.body, partial.body);
}

// AC: PY-05.1
#[tokio::test]
async fn a_refund_without_an_amount_refunds_the_rest_and_a_refunded_capture_takes_no_more() {
    let (app_router, _) = build_test_app();
    let (order_id, capture_id) = capture_new_order(&app_router).await;
    let refund_path = format!("/v2/payments/captures/{capture_id}/refund");
    call_paypal(
        &app_router,
        "POST",
        &refund_path,
        Some(&refund_amount("5.00")),
    )
    .await;

    let rest = call_paypal(&app_router, "POST", &refund_path, None).await;
    let once_more = call_paypal(&app_router, "POST", &refund_path, None).await;
    let order_path = format!("/v2/checkout/orders/{order_id}");
    let order = call_paypal(&app_router, "GET", &order_path, None).await;

    assert_eq!(rest.body["amount"]["value"], "20.00");
    assert_eq!(read_issue(&once_more), "CAPTURE_FULLY_REFUNDED");
    let order_payments = &order.body["purchase_units"][0]["payments"];
    assert_eq!(order_payments["refunds"].as_array().map(Vec::len), Some(2));
    assert_eq!(order_payments["captures"][0]["status"], "REFUNDED");
    let (_, payments) =
        call_api(&app_router, "GET", "/api/v1/payments?provider=paypal", None).await;
    assert_eq!(payments["items"][0]["status"], "refunded");
}

// AC: PY-05.1
#[tokio::test]
async fn requests_paypal_refuses_answer_its_error_shapes() {
    let (app_router, _) = build_test_app();
    let create_with = |order_body: serde_json::Value| {
        let app_router = app_router.clone();
        async move {
            call_paypal(
                &app_router,
                "POST",
                "/v2/checkout/orders",
                Some(&order_body),
            )
            .await
        }
    };

    let without_intent = create_with(
        json!({"purchase_units": [{"amount": {"currency_code": "USD", "value": "1.00"}}]}),
    )
    .await;
    let too_precise = create_with(json!({"intent": "CAPTURE", "purchase_units": [{"amount": {"currency_code": "USD", "value": "1.005"}}]})).await;
    let authorize = create_with(json!({"intent": "AUTHORIZE", "purchase_units": [{"amount": {"currency_code": "USD", "value": "1.00"}}]})).await;
    let unknown_order = call_paypal(
        &app_router,
        "GET",
        "/v2/checkout/orders/5O190127TN364715T",
        None,
    )
    .await;
    let unknown_path = call_paypal(&app_router, "GET", "/v2/invoicing/invoices", None).await;
    let anonymous = send_paypal_request(
        &app_router,
        Request::builder()
            .method("GET")
            .uri(format!("{PAYPAL_PATH}/v2/checkout/orders/X")),
        String::new(),
    )
    .await;

    assert_eq!(without_intent.status, 400);
    assert_eq!(without_intent.body["name"], "INVALID_REQUEST");
    assert_eq!(without_intent.body["details"][0]["field"], "/intent");
    assert_eq!(read_issue(&without_intent), "MISSING_REQUIRED_PARAMETER");
    assert_eq!(read_issue(&too_precise), "DECIMAL_PRECISION");
    assert_eq!(read_issue(&authorize), "INVALID_PARAMETER_VALUE");
    assert_eq!(unknown_order.status, 404);
    assert_eq!(read_issue(&unknown_order), "INVALID_RESOURCE_ID");
    assert_eq!(unknown_path.status, 404);
    assert_eq!(anonymous.status, 401);
    assert_eq!(anonymous.body["name"], "AUTHENTICATION_FAILURE");
}

// AC: PY-05.1
#[tokio::test]
async fn the_provider_port_serves_paypal_at_its_real_paths() {
    use tower::ServiceExt;

    let (_, operation_context) = build_test_app();
    let provider_port_router = sendmock_api::build_provider_port_router(&operation_context, None);
    let request = Request::builder()
        .method("POST")
        .uri("/v2/checkout/orders")
        .header("host", "api-m.sandbox.paypal.com")
        .header("authorization", "Bearer A21AAport")
        .header("content-type", "application/json")
        .body(axum::body::Body::from(
            json!({"intent": "CAPTURE", "purchase_units": [{"amount": {"currency_code": "EUR", "value": "9.99"}}]})
                .to_string(),
        ))
        .unwrap_or_else(|error| panic!("a valid request: {error}"));

    let response = provider_port_router
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    let minimal_order: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap_or_default();

    assert_eq!(status, 201, "{minimal_order}");
    assert_eq!(minimal_order["status"], "CREATED");
    assert!(minimal_order.get("purchase_units").is_none());
    assert!(find_link(&minimal_order, "approve").is_some());
}

#[tokio::test]
async fn the_request_log_keeps_the_client_secret_and_tokens_out() {
    let (app_router, _) = build_test_app();
    let basic_pair = STANDARD.encode("AZshopClient:EKshopSecretValue");
    let issued = send_paypal_request(
        &app_router,
        Request::builder()
            .method("POST")
            .uri(format!("{PAYPAL_PATH}/v1/oauth2/token"))
            .header("authorization", format!("Basic {basic_pair}"))
            .header("content-type", "application/x-www-form-urlencoded"),
        "grant_type=client_credentials".to_owned(),
    )
    .await;
    create_order(&app_router).await;

    let (_, logged_page) = call_api(&app_router, "GET", "/api/v1/logs/http", None).await;

    let logged_text = logged_page.to_string();
    assert!(
        logged_text.contains("/providers/paypal/v1/oauth2/token"),
        "{logged_text}"
    );
    assert!(!logged_text.contains("EKshopSecretValue"), "{logged_text}");
    assert!(!logged_text.contains(&basic_pair), "{logged_text}");
    assert!(
        !logged_text.contains(&read_text(&issued.body["access_token"])),
        "{logged_text}"
    );
    assert!(!logged_text.contains("A21AAtest-token"), "{logged_text}");
}
