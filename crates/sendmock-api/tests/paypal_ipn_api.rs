#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use axum::body::Body;
use axum::http::Request;
use sendmock_ops::{OperationContext, RecordedHttpRequest, fire_matching_rules};
use serde_json::json;
use support::test_app::{build_test_app, call_api};
use support::webhook_samples::{create_rule, endpoint_input};
use tower::ServiceExt;

const POSTBACK_PATH: &str = "/cgi-bin/webscr";
const VALIDATE_COMMAND: &str = "cmd=_notify-validate";

/// What the postback answered: status, `Content-Type` and the body text.
struct PostbackReply {
    status: u16,
    content_type: String,
    body: String,
}

async fn send_postback(router: axum::Router, request: Request<Body>) -> PostbackReply {
    let response = router
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|header_value| header_value.to_str().ok())
        .unwrap_or_default()
        .to_owned();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    PostbackReply {
        status,
        content_type,
        body: String::from_utf8_lossy(&body_bytes).into_owned(),
    }
}

fn build_postback(uri: &str, host: Option<&str>, postback_body: String) -> Request<Body> {
    let mut request_builder = Request::builder()
        .method("POST")
        .uri(uri)
        .header("content-type", "application/x-www-form-urlencoded");
    if let Some(postback_host) = host {
        request_builder = request_builder.header("host", postback_host);
    }
    request_builder
        .body(Body::from(postback_body))
        .unwrap_or_else(|error| panic!("a valid request: {error}"))
}

/// Posts the message back under `/providers/paypal`, as an app pointed at SendMock does.
async fn post_back(app_router: &axum::Router, ipn_message: &str) -> String {
    let postback_request = build_postback(
        &format!("/providers/paypal{POSTBACK_PATH}"),
        None,
        format!("{VALIDATE_COMMAND}&{ipn_message}"),
    );
    let postback_reply = send_postback(app_router.clone(), postback_request).await;
    assert_eq!(postback_reply.status, 200, "{}", postback_reply.body);
    postback_reply.body
}

/// An endpoint receiving PayPal IPNs and a rule sending it every `payment.succeeded`.
async fn create_ipn_rule(app_router: &axum::Router) {
    let mut ipn_endpoint = endpoint_input("Shop IPN listener");
    ipn_endpoint["template_id"] = json!("paypal.ipn");
    let (_, created_endpoint) = call_api(
        app_router,
        "POST",
        "/api/v1/webhooks/endpoints",
        Some(&ipn_endpoint),
    )
    .await;
    create_rule(
        app_router,
        &json!({
            "name": "PayPal IPN", "endpoint_id": created_endpoint["id"],
            "events": ["payment.succeeded"], "filter": null, "is_enabled": true,
        }),
    )
    .await;
}

/// A shop with an endpoint receiving PayPal IPNs for every paid payment, and one payment paid.
async fn build_app_with_sent_ipn() -> (axum::Router, OperationContext, RecordedHttpRequest) {
    let (app_router, operation_context) = build_test_app();
    call_api(
        &app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({ "payment_outcome_profile": "auto_success" })),
    )
    .await;
    create_ipn_rule(&app_router).await;
    let (_, payment) = call_api(
        &app_router,
        "POST",
        "/api/v1/payments/checkout",
        Some(&json!({
            "provider": "paypal", "amount_minor": 4_250, "currency": "USD",
            "customer_email": "ruma+shop@example.com",
        })),
    )
    .await;
    assert_eq!(payment["status"], "succeeded", "{payment}");
    let (_, recent_events) = call_api(
        &app_router,
        "GET",
        "/api/v1/events/recent?type=payment.succeeded",
        None,
    )
    .await;
    let succeeded_event = serde_json::from_value(recent_events[0].clone())
        .unwrap_or_else(|error| panic!("a payment.succeeded event: {error}"));
    let queued_count = fire_matching_rules(&operation_context, &succeeded_event)
        .await
        .unwrap_or_default();
    assert_eq!(queued_count, 1);
    let sent_ipn = read_sent_ipn(&app_router, &operation_context).await;
    (app_router, operation_context, sent_ipn)
}

async fn read_sent_ipn(
    app_router: &axum::Router,
    operation_context: &OperationContext,
) -> RecordedHttpRequest {
    let (_, deliveries) = call_api(
        app_router,
        "GET",
        "/api/v1/webhooks/deliveries?event_type=payment.succeeded",
        None,
    )
    .await;
    let delivery_id = deliveries["items"][0]["id"].as_str().unwrap_or_default();
    operation_context
        .webhook_delivery_repository
        .find_delivery(delivery_id)
        .await
        .ok()
        .flatten()
        .and_then(|stored_delivery| stored_delivery.rendered_request_json)
        .and_then(|request_json| serde_json::from_str(&request_json).ok())
        .unwrap_or_else(|| panic!("the IPN delivery {delivery_id}"))
}

fn read_ipn_fields(ipn_message: &str) -> Vec<(String, String)> {
    serde_urlencoded::from_str(ipn_message).unwrap_or_default()
}

fn write_ipn_fields(ipn_fields: &[(String, String)]) -> String {
    serde_urlencoded::to_string(ipn_fields).unwrap_or_default()
}

/// The message with one field's value replaced.
fn replace_field(ipn_message: &str, field_name: &str, field_value: &str) -> String {
    let changed_fields: Vec<(String, String)> = read_ipn_fields(ipn_message)
        .into_iter()
        .map(|(name, value)| {
            if name == field_name {
                (name, field_value.to_owned())
            } else {
                (name, value)
            }
        })
        .collect();
    write_ipn_fields(&changed_fields)
}

// AC: PY-05.3
#[tokio::test]
async fn an_ipn_is_posted_as_a_form_and_its_postback_is_verified() {
    let (app_router, _, sent_ipn) = build_app_with_sent_ipn().await;
    let ipn_fields = read_ipn_fields(&sent_ipn.body);
    let read_field = |field_name: &str| {
        ipn_fields
            .iter()
            .find(|(name, _)| name == field_name)
            .map(|(_, value)| value.clone())
            .unwrap_or_default()
    };

    let verdict = post_back(&app_router, &sent_ipn.body).await;

    assert_eq!(sent_ipn.method, "POST");
    assert!(
        sent_ipn
            .headers
            .iter()
            .any(|(name, value)| name.eq_ignore_ascii_case("content-type")
                && value.starts_with("application/x-www-form-urlencoded")),
        "{:?}",
        sent_ipn.headers
    );
    assert_eq!(read_field("payment_status"), "Completed");
    assert_eq!(read_field("mc_gross"), "42.50");
    assert_eq!(read_field("payer_email"), "ruma+shop@example.com");
    assert!(!read_field("ipn_track_id").is_empty());
    assert_eq!(verdict, "VERIFIED");
}

// AC: PY-05.3
#[tokio::test]
async fn the_message_encoded_again_is_verified_on_the_provider_port_hosts() {
    let (app_router, operation_context, sent_ipn) = build_app_with_sent_ipn().await;
    let encoded_again = write_ipn_fields(&read_ipn_fields(&sent_ipn.body));
    assert_ne!(encoded_again, sent_ipn.body);

    let prefixed_verdict = post_back(&app_router, &encoded_again).await;
    let mut port_replies = Vec::new();
    for postback_host in ["ipnpb.sandbox.paypal.com", "www.paypal.com"] {
        let provider_port_router =
            sendmock_api::build_provider_port_router(&operation_context, None);
        let postback_request = build_postback(
            POSTBACK_PATH,
            Some(postback_host),
            format!("{VALIDATE_COMMAND}&{}", sent_ipn.body),
        );
        port_replies.push(send_postback(provider_port_router, postback_request).await);
    }

    assert_eq!(prefixed_verdict, "VERIFIED");
    for port_reply in port_replies {
        assert_eq!(port_reply.status, 200);
        assert!(port_reply.content_type.starts_with("text/plain"));
        assert_eq!(port_reply.body, "VERIFIED");
    }
}

// AC: PY-05.3
#[tokio::test]
async fn an_altered_reordered_or_unknown_message_is_invalid() {
    let (app_router, _, sent_ipn) = build_app_with_sent_ipn().await;
    let mut reordered_fields = read_ipn_fields(&sent_ipn.body);
    reordered_fields.swap(0, 1);
    let shortened_fields: Vec<(String, String)> = read_ipn_fields(&sent_ipn.body)
        .into_iter()
        .filter(|(name, _)| name != "custom")
        .collect();
    let without_lookup_fields: Vec<(String, String)> = read_ipn_fields(&sent_ipn.body)
        .into_iter()
        .filter(|(name, _)| !["ipn_track_id", "verify_sign", "txn_id"].contains(&name.as_str()))
        .collect();
    let altered_messages = [
        replace_field(&sent_ipn.body, "mc_gross", "0.01"),
        replace_field(&sent_ipn.body, "payment_status", "Refunded"),
        replace_field(&sent_ipn.body, "ipn_track_id", "0123456789abc"),
        write_ipn_fields(&reordered_fields),
        write_ipn_fields(&shortened_fields),
        write_ipn_fields(&without_lookup_fields),
    ];

    let mut verdicts = Vec::new();
    for altered_message in &altered_messages {
        verdicts.push(post_back(&app_router, altered_message).await);
    }
    let without_command = send_postback(
        app_router.clone(),
        build_postback(
            &format!("/providers/paypal{POSTBACK_PATH}"),
            None,
            sent_ipn.body.clone(),
        ),
    )
    .await;

    assert_eq!(verdicts, vec!["INVALID"; altered_messages.len()]);
    assert_eq!(without_command.body, "INVALID");
}
