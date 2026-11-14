#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod stripe_requests;
    pub mod test_app;
}

use serde_json::json;
use support::stripe_requests::{
    StripeReply, call_stripe, call_stripe_with_key, create_payment_intent, find_payment,
    list_timeline_kinds, read_text,
};
use support::test_app::build_test_app;

// AC: PY-04.1
#[tokio::test]
async fn creates_confirms_and_retrieves_a_payment_intent_in_stripe_shape() {
    let (app_router, _) = build_test_app();

    let created =
        create_payment_intent(&app_router, "metadata[order_id]=7&description=Shirt").await;
    let intent_id = read_text(&created.body["id"]);
    let confirmed = call_stripe(
        &app_router,
        "POST",
        &format!("/payment_intents/{intent_id}/confirm"),
        "payment_method=pm_card_visa",
    )
    .await;
    let retrieved = call_stripe(
        &app_router,
        "GET",
        &format!("/payment_intents/{intent_id}"),
        "",
    )
    .await;

    assert_eq!(created.status, 200, "{}", created.body);
    assert!(
        created
            .request_id
            .is_some_and(|request_id| request_id.starts_with("req_"))
    );
    assert!(intent_id.starts_with("pi_"));
    assert_eq!(created.body["object"], "payment_intent");
    assert_eq!(created.body["status"], "requires_payment_method");
    assert_eq!(created.body["currency"], "usd");
    assert_eq!(created.body["metadata"], json!({"order_id": "7"}));
    assert_eq!(created.body["livemode"], false);
    assert!(read_text(&created.body["client_secret"]).starts_with(&format!("{intent_id}_secret_")));
    assert_eq!(confirmed.status, 200, "{}", confirmed.body);
    assert_eq!(confirmed.body["status"], "succeeded");
    assert_eq!(confirmed.body["amount_received"], 2000);
    assert_eq!(
        confirmed.body["latest_charge"],
        intent_id.replacen("pi_", "ch_", 1)
    );
    assert_eq!(retrieved.body, confirmed.body);
    let payment = find_payment(&app_router, &intent_id).await;
    assert_eq!(payment["status"], "succeeded");
    assert_eq!(payment["method"]["last4"], "4242");
}

// AC: PY-04.1
#[tokio::test]
async fn answers_stripe_errors_for_missing_params_unknown_ids_keys_and_urls() {
    let (app_router, _) = build_test_app();

    let missing_amount = call_stripe(&app_router, "POST", "/payment_intents", "currency=usd").await;
    let unknown_intent = call_stripe(&app_router, "GET", "/payment_intents/pi_missing", "").await;
    let no_key =
        call_stripe_with_key(&app_router, "GET", "/payment_intents/pi_missing", "", None).await;
    let live_key = call_stripe_with_key(
        &app_router,
        "GET",
        "/payment_intents/pi_missing",
        "",
        Some("sk_live_realkey1234"),
    )
    .await;
    let unknown_url = call_stripe(&app_router, "POST", "/charges", "amount=100").await;

    assert_eq!(missing_amount.status, 400);
    assert_eq!(
        missing_amount.body,
        json!({"error": {
            "type": "invalid_request_error",
            "code": "parameter_missing",
            "doc_url": "https://stripe.com/docs/error-codes/parameter-missing",
            "message": "Missing required param: amount.",
            "param": "amount",
        }})
    );
    assert_eq!(unknown_intent.status, 404);
    assert_eq!(unknown_intent.body["error"]["code"], "resource_missing");
    assert_eq!(
        unknown_intent.body["error"]["message"],
        "No such payment_intent: 'pi_missing'"
    );
    assert_eq!(no_key.status, 401);
    assert_eq!(live_key.status, 401);
    assert_eq!(
        live_key.body["error"]["message"],
        "Invalid API Key provided: sk_live_****1234"
    );
    assert_eq!(unknown_url.status, 404);
    assert_eq!(unknown_url.body["error"]["type"], "invalid_request_error");
}

/// A test PaymentMethod and what Stripe answers for it.
struct TestCardCase {
    payment_method: &'static str,
    http_status: u16,
    intent_status: &'static str,
    error_code: Option<&'static str>,
    decline_code: Option<&'static str>,
}

const fn paid_case(payment_method: &'static str, intent_status: &'static str) -> TestCardCase {
    TestCardCase {
        payment_method,
        http_status: 200,
        intent_status,
        error_code: None,
        decline_code: None,
    }
}

const fn declined_case(
    payment_method: &'static str,
    error_code: &'static str,
    decline_code: Option<&'static str>,
) -> TestCardCase {
    TestCardCase {
        payment_method,
        http_status: 402,
        intent_status: "requires_payment_method",
        error_code: Some(error_code),
        decline_code,
    }
}

const TEST_CARD_CASES: [TestCardCase; 8] = [
    paid_case("pm_card_visa", "succeeded"),
    paid_case("pm_card_mastercard", "succeeded"),
    declined_case(
        "pm_card_visa_chargeDeclined",
        "card_declined",
        Some("generic_decline"),
    ),
    declined_case(
        "tok_chargeDeclinedInsufficientFunds",
        "card_declined",
        Some("insufficient_funds"),
    ),
    declined_case("pm_card_chargeDeclinedExpiredCard", "expired_card", None),
    declined_case("pm_card_chargeDeclinedIncorrectCvc", "incorrect_cvc", None),
    paid_case("pm_card_authenticationRequiredOnSetup", "requires_action"),
    paid_case("pm_card_createDispute", "succeeded"),
];

fn assert_test_card_reply(test_card_case: &TestCardCase, reply: &StripeReply) {
    let payment_method = test_card_case.payment_method;
    assert_eq!(
        reply.status, test_card_case.http_status,
        "{payment_method}: {}",
        reply.body
    );
    let is_declined = reply.status == 402;
    let payment_intent = if is_declined {
        &reply.body["error"]["payment_intent"]
    } else {
        &reply.body
    };
    assert_eq!(
        payment_intent["status"], test_card_case.intent_status,
        "{payment_method}"
    );
    assert_eq!(
        reply.body["error"]["code"],
        json!(test_card_case.error_code),
        "{payment_method}"
    );
    assert_eq!(
        reply.body["error"]["decline_code"],
        json!(test_card_case.decline_code),
        "{payment_method}"
    );
    if is_declined {
        assert_eq!(reply.body["error"]["type"], "card_error");
        assert_eq!(
            payment_intent["last_payment_error"]["code"],
            json!(test_card_case.error_code)
        );
        assert_eq!(payment_intent["payment_method"], json!(null));
    }
}

// AC: PY-04.2
#[tokio::test]
async fn each_test_card_gives_stripes_status_and_decline_code() {
    let (app_router, _) = build_test_app();

    for test_card_case in &TEST_CARD_CASES {
        let confirm_form = format!(
            "confirm=true&payment_method={}",
            test_card_case.payment_method
        );
        let reply = create_payment_intent(&app_router, &confirm_form).await;

        assert_test_card_reply(test_card_case, &reply);
    }
}

// AC: PY-04.2
#[tokio::test]
async fn a_three_ds_card_waits_for_the_challenge_and_a_dispute_card_opens_a_dispute() {
    let (app_router, _) = build_test_app();

    let three_ds = create_payment_intent(&app_router, "confirm=true&payment_method=pm_card_authenticationRequiredOnSetup&return_url=https://shop.test/done").await;
    let dispute = create_payment_intent(
        &app_router,
        "confirm=true&payment_method=pm_card_createDispute",
    )
    .await;

    let next_action = &three_ds.body["next_action"];
    assert_eq!(next_action["type"], "redirect_to_url");
    assert_eq!(
        next_action["redirect_to_url"]["return_url"],
        "https://shop.test/done"
    );
    assert!(
        read_text(&next_action["redirect_to_url"]["url"]).starts_with("http://127.0.0.1:8025/pay/")
    );
    let disputed_payment = find_payment(&app_router, &read_text(&dispute.body["id"])).await;
    assert_eq!(disputed_payment["status"], "disputed");
}

// AC: PY-04.2
#[tokio::test]
async fn a_declined_intent_can_be_confirmed_again_with_another_card() {
    let (app_router, _) = build_test_app();
    let declined = create_payment_intent(
        &app_router,
        "confirm=true&payment_method=pm_card_visa_chargeDeclined",
    )
    .await;
    let intent_id = read_text(&declined.body["error"]["payment_intent"]["id"]);

    let retried = call_stripe(
        &app_router,
        "POST",
        &format!("/payment_intents/{intent_id}/confirm"),
        "payment_method=pm_card_visa",
    )
    .await;

    assert_eq!(retried.status, 200, "{}", retried.body);
    assert_eq!(retried.body["status"], "succeeded");
    assert_eq!(retried.body["last_payment_error"], json!(null));
}

// AC: PY-04.1
#[tokio::test]
async fn refuses_raw_card_numbers_and_keeps_them_out_of_the_request_log() {
    let (app_router, _) = build_test_app();

    let raw_card = create_payment_intent(&app_router, "confirm=true&payment_method_data[type]=card&payment_method_data[card][number]=4242424242424242").await;
    let (_, logged_page) =
        support::test_app::call_api(&app_router, "GET", "/api/v1/logs/http", None).await;

    assert_eq!(raw_card.status, 400);
    assert!(
        read_text(&raw_card.body["error"]["message"])
            .starts_with("Sending credit card numbers directly")
    );
    assert!(
        logged_page
            .to_string()
            .contains("/providers/stripe/v1/payment_intents"),
        "{logged_page}"
    );
    assert!(
        !logged_page.to_string().contains("4242424242424242"),
        "{logged_page}"
    );
}

// AC: PY-04.1, PY-07.1
#[tokio::test]
async fn manual_capture_authorizes_then_captures_part_of_the_amount() {
    let (app_router, _) = build_test_app();
    let authorized = create_payment_intent(
        &app_router,
        "capture_method=manual&confirm=true&payment_method=pm_card_visa",
    )
    .await;
    let intent_id = read_text(&authorized.body["id"]);

    let captured = call_stripe(
        &app_router,
        "POST",
        &format!("/payment_intents/{intent_id}/capture"),
        "amount_to_capture=1500",
    )
    .await;
    let captured_again = call_stripe(
        &app_router,
        "POST",
        &format!("/payment_intents/{intent_id}/capture"),
        "",
    )
    .await;

    assert_eq!(authorized.body["status"], "requires_capture");
    assert_eq!(authorized.body["capture_method"], "manual");
    assert_eq!(authorized.body["amount_capturable"], 2000);
    assert_eq!(captured.body["status"], "succeeded", "{}", captured.body);
    assert_eq!(captured.body["amount_received"], 1500);
    assert_eq!(captured_again.status, 400);
    assert_eq!(
        captured_again.body["error"]["code"],
        "payment_intent_unexpected_state"
    );
    let payment = find_payment(&app_router, &intent_id).await;
    assert_eq!(payment["capture_method"], "manual");
    assert_eq!(payment["captured_minor"], 1500);
    assert_eq!(
        list_timeline_kinds(&payment),
        vec!["created", "authorized", "captured"]
    );
}

// AC: PY-04.1, PY-07.1
#[tokio::test]
async fn canceling_voids_an_authorization_and_refuses_a_paid_intent() {
    let (app_router, _) = build_test_app();
    let authorized = create_payment_intent(
        &app_router,
        "capture_method=manual&confirm=true&payment_method=pm_card_visa",
    )
    .await;
    let paid = create_payment_intent(&app_router, "confirm=true&payment_method=pm_card_visa").await;
    let authorized_id = read_text(&authorized.body["id"]);

    let voided = call_stripe(
        &app_router,
        "POST",
        &format!("/payment_intents/{authorized_id}/cancel"),
        "cancellation_reason=requested_by_customer",
    )
    .await;
    let refused = call_stripe(
        &app_router,
        "POST",
        &format!("/payment_intents/{}/cancel", read_text(&paid.body["id"])),
        "",
    )
    .await;

    assert_eq!(voided.body["status"], "canceled", "{}", voided.body);
    assert_eq!(voided.body["cancellation_reason"], "requested_by_customer");
    assert_eq!(voided.body["canceled_at"], 1_767_225_600);
    assert_eq!(refused.status, 400);
    assert_eq!(
        refused.body["error"]["code"],
        "payment_intent_unexpected_state"
    );
    let voided_payment = find_payment(&app_router, &authorized_id).await;
    assert_eq!(voided_payment["status"], "canceled");
}

// AC: PY-04.1
#[tokio::test]
async fn the_provider_port_serves_stripe_at_its_real_paths() {
    use axum::body::Body;
    use axum::http::Request;
    use tower::ServiceExt;

    let (_, operation_context) = build_test_app();
    let provider_port_router = sendmock_api::build_provider_port_router(&operation_context, None);
    let request = Request::builder()
        .method("POST")
        .uri("/v1/payment_intents")
        .header("host", "api.stripe.com")
        .header("authorization", "Bearer sk_test_port")
        .header("content-type", "application/x-www-form-urlencoded")
        .body(Body::from(
            "amount=1000&currency=eur&confirm=true&payment_method=pm_card_visa",
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
    let payment_intent: serde_json::Value = serde_json::from_slice(&body_bytes).unwrap_or_default();

    assert_eq!(status, 200, "{payment_intent}");
    assert_eq!(payment_intent["status"], "succeeded");
    assert_eq!(payment_intent["currency"], "eur");
}
