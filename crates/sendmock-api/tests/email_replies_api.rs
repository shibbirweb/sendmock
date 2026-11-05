#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use sendmock_ops::{OperationContext, RecentEventFilter};
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

async fn send_original(app_router: &axum::Router) -> Value {
    let (status, sent) = call_api(
        app_router,
        "POST",
        "/api/v1/send",
        Some(&json!({
            "from": "Shop <shop@example.test>",
            "to": ["Sam <sam@example.test>", "lee@example.test"],
            "subject": "Your receipt",
            "text": "Thanks for your order",
            "headers": { "Reply-To": "support@shop.test" },
            "attachments": [{ "filename": "receipt.txt", "content": "aGVsbG8=" }],
        })),
    )
    .await;
    assert_eq!(status, 201, "{sent}");
    read_detail(app_router, sent["id"].as_str().unwrap_or_default()).await
}

async fn read_detail(app_router: &axum::Router, email_id: &str) -> Value {
    call_api(
        app_router,
        "GET",
        &format!("/api/v1/emails/{email_id}"),
        None,
    )
    .await
    .1
}

async fn respond(
    app_router: &axum::Router,
    email_id: &Value,
    action: &str,
    response_body: Value,
) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        &format!(
            "/api/v1/emails/{}/{action}",
            email_id.as_str().unwrap_or_default()
        ),
        Some(&response_body),
    )
    .await
}

fn count_events(operation_context: &OperationContext, event_type: &str) -> usize {
    operation_context
        .event_bus
        .recent_events(&RecentEventFilter {
            created_after_unix_ms: None,
            event_type: Some(event_type.to_owned()),
            limit: 100,
        })
        .len()
}

// AC: EM-17.1 EM-17.3
#[tokio::test]
async fn a_reply_arrives_inbound_to_the_reply_to_address_threaded_and_quoted() {
    let (app_router, operation_context) = build_test_app();
    let original = send_original(&app_router).await;

    let (status, reply) = respond(
        &app_router,
        &original["id"],
        "reply",
        json!({ "body": "Where is it?" }),
    )
    .await;

    assert_eq!(status, 201, "{reply}");
    assert_eq!(reply["direction"], "inbound");
    assert_eq!(reply["response_kind"], "reply");
    assert_eq!(reply["from"]["address"], "sam@example.test");
    assert_eq!(reply["to"][0]["address"], "support@shop.test");
    assert_eq!(reply["subject"], "Re: Your receipt");
    let original_reference = format!("<{}>", original["message_id"].as_str().unwrap_or_default());
    assert_eq!(
        reply["headers"]["In-Reply-To"][0],
        original_reference.as_str()
    );
    assert_eq!(
        reply["headers"]["References"][0],
        original_reference.as_str()
    );
    let reply_text = reply["text_body"].as_str().unwrap_or_default();
    assert!(
        reply_text.starts_with("Where is it?\n\nOn "),
        "{reply_text}"
    );
    assert!(reply_text.contains("Shop <shop@example.test> wrote:\n> Thanks for your order"));
    assert_eq!(reply["response_to"]["email_id"], original["id"]);
    assert_eq!(count_events(&operation_context, "email.inbound"), 1);
    assert_eq!(count_events(&operation_context, "email.received"), 1);
}

// AC: EM-17.4
#[tokio::test]
async fn reply_all_copies_the_others_and_a_forward_carries_the_original_and_its_files() {
    let (app_router, _) = build_test_app();
    let original = send_original(&app_router).await;

    let (_, reply_all) = respond(
        &app_router,
        &original["id"],
        "reply",
        json!({ "body": "Thanks", "reply_all": true }),
    )
    .await;
    let (forward_status, forward) = respond(
        &app_router,
        &original["id"],
        "forward",
        json!({ "to": "billing@inbound.app.test", "body": "FYI" }),
    )
    .await;
    let (_, bare_forward) = respond(
        &app_router,
        &original["id"],
        "forward",
        json!({ "to": "billing@inbound.app.test", "include_attachments": false, "include_original": false }),
    )
    .await;

    assert_eq!(reply_all["cc"][0]["address"], "lee@example.test");
    assert_eq!(forward_status, 201, "{forward}");
    assert_eq!(forward["subject"], "Fwd: Your receipt");
    assert_eq!(forward["to"][0]["address"], "billing@inbound.app.test");
    assert!(forward["headers"]["In-Reply-To"].is_null());
    let forward_text = forward["text_body"].as_str().unwrap_or_default();
    assert!(
        forward_text.starts_with(
            "FYI\n\n---------- Forwarded message ---------\nFrom: Shop <shop@example.test>"
        ),
        "{forward_text}"
    );
    assert_eq!(forward["attachments"][0]["filename"], "receipt.txt");
    assert_eq!(bare_forward["attachments"], json!([]));
}

// AC: EM-17.5
#[tokio::test]
async fn the_original_lists_its_replies_and_forwards_on_its_detail_and_timeline() {
    let (app_router, _) = build_test_app();
    let original = send_original(&app_router).await;
    let original_id = original["id"].as_str().unwrap_or_default();

    respond(
        &app_router,
        &original["id"],
        "reply",
        json!({ "body": "Hi" }),
    )
    .await;
    respond(
        &app_router,
        &original["id"],
        "forward",
        json!({ "to": "a@inbound.app.test" }),
    )
    .await;
    let original_detail = read_detail(&app_router, original_id).await;
    let (_, timeline) = call_api(
        &app_router,
        "GET",
        &format!("/api/v1/emails/{original_id}/timeline"),
        None,
    )
    .await;

    let response_kinds: Vec<&Value> = original_detail["responses"]
        .as_array()
        .into_iter()
        .flatten()
        .map(|response_link| &response_link["kind"])
        .collect();
    assert_eq!(response_kinds, [&json!("reply"), &json!("forward")]);
    let timeline_kinds: Vec<&Value> = timeline
        .as_array()
        .into_iter()
        .flatten()
        .map(|timeline_entry| &timeline_entry["kind"])
        .collect();
    assert!(timeline_kinds.contains(&&json!("replied")), "{timeline}");
    assert!(
        timeline_kinds.contains(&&json!("forwarded_by_recipient")),
        "{timeline}"
    );
}

// AC: EM-17.5
#[tokio::test]
async fn incoming_mail_is_not_answered_and_empty_replies_are_refused() {
    let (app_router, _) = build_test_app();
    let original = send_original(&app_router).await;
    let (_, reply) = respond(
        &app_router,
        &original["id"],
        "reply",
        json!({ "body": "Hi" }),
    )
    .await;

    let (reply_again_status, refusal) =
        respond(&app_router, &reply["id"], "reply", json!({ "body": "Hi" })).await;
    let (empty_status, _) = respond(
        &app_router,
        &original["id"],
        "reply",
        json!({ "body": " " }),
    )
    .await;
    let (no_address_status, _) = respond(
        &app_router,
        &original["id"],
        "forward",
        json!({ "to": "nobody" }),
    )
    .await;

    assert_eq!(reply_again_status, 409, "{refusal}");
    assert_eq!([empty_status, no_address_status], [400, 400]);
}

// AC: EM-17.2 EM-17.3
#[tokio::test]
async fn incoming_email_from_fields_or_raw_mime_fires_email_inbound_only() {
    let (app_router, operation_context) = build_test_app();

    let (fields_status, from_fields) = call_api(
        &app_router,
        "POST",
        "/api/v1/emails/inbound",
        Some(&json!({ "from": "Sam <sam@example.test>", "to": ["support@inbound.app.test"], "subject": "Help", "text": "My order" })),
    )
    .await;
    let (raw_status, from_raw) = call_api(
        &app_router,
        "POST",
        "/api/v1/emails/inbound",
        Some(&json!({ "raw": "From: lee@example.test\r\nTo: support@inbound.app.test\r\nSubject: Raw help\r\n\r\nHello" })),
    )
    .await;
    let (missing_status, _) = call_api(
        &app_router,
        "POST",
        "/api/v1/emails/inbound",
        Some(&json!({ "subject": "No one" })),
    )
    .await;

    assert_eq!([fields_status, raw_status, missing_status], [201, 201, 400]);
    let fields_detail =
        read_detail(&app_router, from_fields["id"].as_str().unwrap_or_default()).await;
    let raw_detail = read_detail(&app_router, from_raw["id"].as_str().unwrap_or_default()).await;
    assert_eq!(fields_detail["direction"], "inbound");
    assert_eq!(fields_detail["source"], "simulated");
    assert_eq!(raw_detail["subject"], "Raw help");
    assert_eq!(raw_detail["direction"], "inbound");
    assert_eq!(count_events(&operation_context, "email.inbound"), 2);
    assert_eq!(count_events(&operation_context, "email.received"), 0);
}
