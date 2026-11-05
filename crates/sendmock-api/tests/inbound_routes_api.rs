#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod fake_email_relay;
    pub mod scripted_webhook_sender;
    pub mod test_app;
}

use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::Duration;

use sendmock_ops::{OperationContext, RecordedHttpRequest, run_due_deliveries};
use sendmock_webhooks::sign_mailgun_token;
use serde_json::{Value, json};
use support::scripted_webhook_sender::{ScriptedAnswer, ScriptedWebhookSender};
use support::test_app::{build_test_app, build_test_app_with, call_api};

const ROUTES_PATH: &str = "/api/v1/inbound-routes";

struct RouteFixture {
    app_router: axum::Router,
    operation_context: OperationContext,
    webhook_sender: Arc<ScriptedWebhookSender>,
}

fn build_fixture(scripted_answers: &[ScriptedAnswer]) -> RouteFixture {
    let webhook_sender = Arc::new(ScriptedWebhookSender::answering(scripted_answers));
    let (app_router, operation_context) = build_test_app_with(|operation_context| {
        operation_context.with_webhook_sender(webhook_sender.clone())
    });
    RouteFixture {
        app_router,
        operation_context,
        webhook_sender,
    }
}

async fn create_route(app_router: &axum::Router, route_input: Value) -> Value {
    let (status, created) = call_api(app_router, "POST", ROUTES_PATH, Some(&route_input)).await;
    assert_eq!(status, 201, "{created}");
    created
}

async fn receive_email(app_router: &axum::Router, recipient: &str, text: &str) -> String {
    let (status, received) = call_api(
        app_router,
        "POST",
        "/api/v1/emails/inbound",
        Some(&json!({ "from": "Sam <sam@example.test>", "to": [recipient], "subject": "Re: Ticket", "text": text })),
    )
    .await;
    assert_eq!(status, 201, "{received}");
    received["id"].as_str().unwrap_or_default().to_owned()
}

/// Routes run in the background; this waits until `count` route deliveries are queued.
async fn wait_for_deliveries(app_router: &axum::Router, count: usize) -> Vec<Value> {
    let mut deliveries = Vec::new();
    for _ in 0..40 {
        let (_, page) = call_api(app_router, "GET", "/api/v1/webhooks/deliveries", None).await;
        deliveries = page["items"].as_array().cloned().unwrap_or_default();
        if deliveries.len() >= count {
            break;
        }
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    deliveries
}

/// The fields of a multipart body, by name.
fn read_form_fields(sent_request: &RecordedHttpRequest) -> BTreeMap<String, String> {
    let boundary = sent_request
        .headers
        .get("content-type")
        .and_then(|content_type| content_type.split("boundary=").nth(1))
        .unwrap_or_default();
    sent_request
        .body
        .split(&format!("--{boundary}"))
        .filter_map(|form_part| {
            let (part_headers, part_value) = form_part.split_once("\r\n\r\n")?;
            let field_name = part_headers.split("name=\"").nth(1)?.split('"').next()?;
            Some((
                field_name.to_owned(),
                part_value.trim_end_matches("\r\n").to_owned(),
            ))
        })
        .collect()
}

// AC: WH-12.1 WH-12.2 WH-12.3
#[tokio::test]
async fn a_matching_route_posts_mailgun_fields_with_its_captured_group_and_a_valid_signature() {
    let fixture = build_fixture(&[]);
    create_route(
        &fixture.app_router,
        json!({
            "priority": 1, "description": "Ticket replies",
            "filter": { "kind": "match_recipient", "pattern": "reply\\+(?P<ticket>\\d+)@reply\\.app\\.test" },
            "actions": [{ "kind": "forward_url", "url": "http://localhost:8000/tickets/\\g<ticket>/mail" }],
        }),
    )
    .await;

    receive_email(
        &fixture.app_router,
        "reply+42@reply.app.test",
        "Fixed, thanks.\n-- \nSam\n\nOn Thu, 01 Jan 2026 00:00:00 GMT, Shop <shop@example.test> wrote:\n> Is it fixed?",
    )
    .await;
    wait_for_deliveries(&fixture.app_router, 1).await;
    run_due_deliveries(&fixture.operation_context, 2)
        .await
        .unwrap_or_else(|error| panic!("the pass runs: {error}"));

    let sent_requests = fixture.webhook_sender.received_requests();
    assert_eq!(sent_requests.len(), 1);
    assert_eq!(
        sent_requests[0].url,
        "http://localhost:8000/tickets/42/mail"
    );
    let form_fields = read_form_fields(&sent_requests[0]);
    assert_eq!(form_fields["recipient"], "reply+42@reply.app.test");
    assert_eq!(form_fields["sender"], "sam@example.test");
    assert_eq!(form_fields["stripped-text"], "Fixed, thanks.");
    assert_eq!(form_fields["stripped-signature"], "Sam");
    assert_eq!(
        form_fields["signature"],
        sign_mailgun_token(
            "key-sendmock",
            &form_fields["timestamp"],
            &form_fields["token"]
        )
    );
}

// AC: WH-12.1
#[tokio::test]
async fn routes_run_in_priority_order_and_stop_skips_the_rest() {
    let fixture = build_fixture(&[]);
    for (priority, route_url, actions_end) in [
        (5, "http://localhost:8000/second", json!([])),
        (
            1,
            "http://localhost:8000/first",
            json!([{ "kind": "stop" }]),
        ),
    ] {
        let mut actions = vec![json!({ "kind": "forward_url", "url": route_url })];
        actions.extend(actions_end.as_array().cloned().unwrap_or_default());
        create_route(
            &fixture.app_router,
            json!({ "priority": priority, "description": "", "filter": { "kind": "catch_all" }, "actions": actions }),
        )
        .await;
    }
    let (_, listed) = call_api(&fixture.app_router, "GET", ROUTES_PATH, None).await;

    receive_email(&fixture.app_router, "support@inbound.app.test", "Hello").await;
    let deliveries = wait_for_deliveries(&fixture.app_router, 1).await;
    tokio::time::sleep(Duration::from_millis(200)).await;

    assert_eq!(listed[0]["priority"], 1);
    assert_eq!(listed[0]["expression"], "catch_all()");
    assert_eq!(listed[0]["action_expressions"][1], "stop()");
    assert_eq!(
        wait_for_deliveries(&fixture.app_router, 2).await.len(),
        1,
        "{deliveries:?}"
    );
}

async fn read_timeline(app_router: &axum::Router, email_id: &str) -> Value {
    call_api(
        app_router,
        "GET",
        &format!("/api/v1/emails/{email_id}/timeline"),
        None,
    )
    .await
    .1
}

/// One route forwarding one email to an app that answers `app_answer`; the first attempt
/// as the delivery log shows it, and the email's timeline.
async fn forward_once(app_answer: ScriptedAnswer) -> (Value, Value) {
    let fixture = build_fixture(&[app_answer]);
    create_route(
        &fixture.app_router,
        json!({
            "priority": 0, "description": "Orders app", "filter": { "kind": "catch_all" },
            "actions": [{ "kind": "forward_url", "url": "http://localhost:8000/mail" }],
        }),
    )
    .await;
    let email_id = receive_email(&fixture.app_router, "support@inbound.app.test", "Hi").await;
    wait_for_deliveries(&fixture.app_router, 1).await;
    run_due_deliveries(&fixture.operation_context, 1)
        .await
        .unwrap_or_else(|error| panic!("the pass runs: {error}"));
    let deliveries = wait_for_deliveries(&fixture.app_router, 1).await;
    let first_attempt = deliveries
        .iter()
        .find(|delivery| delivery["attempt"] == 1)
        .cloned()
        .unwrap_or(Value::Null);
    (
        first_attempt,
        read_timeline(&fixture.app_router, &email_id).await,
    )
}

// AC: WH-12.4
#[tokio::test]
async fn a_406_answer_is_final_and_is_in_the_delivery_log_and_timeline() {
    let (first_attempt, timeline) = forward_once(ScriptedAnswer::Status(406)).await;

    assert_eq!(first_attempt["status"], "failed", "{first_attempt}");
    assert_eq!(first_attempt["next_attempt_at"], Value::Null);
    assert!(
        timeline
            .to_string()
            .contains("Forwarded by route Orders app"),
        "{timeline}"
    );
}

// AC: WH-12.4
#[tokio::test]
async fn a_server_error_is_retried_by_the_default_policy() {
    let (first_attempt, _) = forward_once(ScriptedAnswer::Status(503)).await;

    assert_eq!(first_attempt["status"], "failed", "{first_attempt}");
    assert!(
        first_attempt["next_attempt_at"].is_string(),
        "{first_attempt}"
    );
}

// AC: WH-12.5
#[tokio::test]
async fn forward_to_an_address_needs_the_allowlist_and_store_notifies_with_a_message_url() {
    let fixture = build_fixture(&[]);
    create_route(
        &fixture.app_router,
        json!({
            "priority": 0, "description": "Keep", "filter": { "kind": "catch_all" },
            "actions": [
                { "kind": "forward_email", "address": "boss@example.test" },
                { "kind": "store", "notify_url": "http://localhost:8000/stored" },
            ],
        }),
    )
    .await;

    let email_id = receive_email(&fixture.app_router, "support@inbound.app.test", "Hi").await;
    wait_for_deliveries(&fixture.app_router, 1).await;
    run_due_deliveries(&fixture.operation_context, 2)
        .await
        .unwrap_or_else(|error| panic!("the pass runs: {error}"));
    let (_, timeline) = call_api(
        &fixture.app_router,
        "GET",
        &format!("/api/v1/emails/{email_id}/timeline"),
        None,
    )
    .await;

    assert!(
        timeline
            .to_string()
            .contains("Not forwarded to boss@example.test: not on the release allowlist"),
        "{timeline}"
    );
    let form_fields = read_form_fields(&fixture.webhook_sender.received_requests()[0]);
    assert!(
        form_fields["message-url"].ends_with(&format!("/v3/domains/inbound/messages/{email_id}")),
        "{form_fields:?}"
    );
}

#[tokio::test]
async fn routes_are_checked_like_the_editor_and_the_test_reports_captured_groups() {
    let (app_router, _) = build_test_app();
    let refused_routes = [
        json!({ "priority": -1, "description": "", "filter": { "kind": "catch_all" }, "actions": [{ "kind": "stop" }] }),
        json!({ "priority": 0, "description": "", "filter": { "kind": "match_recipient", "pattern": "(" }, "actions": [{ "kind": "stop" }] }),
        json!({ "priority": 0, "description": "", "filter": { "kind": "catch_all" }, "actions": [] }),
        json!({ "priority": 0, "description": "", "filter": { "kind": "catch_all" }, "actions": [{ "kind": "forward_url", "url": "ftp://x" }] }),
    ];
    let mut statuses = Vec::new();
    for refused_route in refused_routes {
        statuses.push(
            call_api(&app_router, "POST", ROUTES_PATH, Some(&refused_route))
                .await
                .0,
        );
    }
    receive_email(&app_router, "reply+7@reply.app.test", "Hi").await;

    let (test_status, test_result) = call_api(
        &app_router,
        "POST",
        &format!("{ROUTES_PATH}/test"),
        Some(&json!({ "filter": { "kind": "match_recipient", "pattern": "reply\\+(?P<ticket>\\d+)@.*" } })),
    )
    .await;

    assert_eq!(statuses, [400, 400, 400, 400]);
    assert_eq!(test_status, 200, "{test_result}");
    assert_eq!(test_result["checked_count"], 1);
    assert_eq!(test_result["matches"][0]["captured_groups"]["ticket"], "7");
}

// AC: WH-12.2
#[tokio::test]
async fn attachments_are_file_parts_from_sendmock_and_a_mime_url_gets_body_mime() {
    let fixture = build_fixture(&[]);
    create_route(
        &fixture.app_router,
        json!({
            "priority": 0, "description": "Files", "filter": { "kind": "catch_all" },
            "actions": [
                { "kind": "forward_url", "url": "http://localhost:8000/mail" },
                { "kind": "forward_url", "url": "http://localhost:8000/mail/mime" },
            ],
        }),
    )
    .await;
    let raw_message = "From: sam@example.test\r\nTo: support@inbound.app.test\r\nSubject: Files\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"m\"\r\n\r\n--m\r\nContent-Type: text/plain\r\n\r\nSee attached\r\n--m\r\nContent-Type: text/plain\r\nContent-Disposition: attachment; filename=\"notes.txt\"\r\n\r\nhello\r\n--m--\r\n";
    let (_, received) = call_api(
        &fixture.app_router,
        "POST",
        "/api/v1/emails/inbound",
        Some(&json!({ "raw": raw_message })),
    )
    .await;
    let email_id = received["id"].as_str().unwrap_or_default();

    let deliveries = wait_for_deliveries(&fixture.app_router, 2).await;

    let body_for = |url: &str| {
        deliveries
            .iter()
            .find(|delivery| delivery["request"]["url"] == url)
            .and_then(|delivery| delivery["request"]["body"].as_str())
            .unwrap_or_default()
            .to_owned()
    };
    let parsed_body = body_for("http://localhost:8000/mail");
    assert!(
        parsed_body.contains(
            "name=\"attachment-1\"; filename=\"notes.txt\"\r\nX-Sendmock-File-Url: http://"
        ),
        "{parsed_body}"
    );
    assert!(
        parsed_body.contains(&format!("/api/v1/emails/{email_id}/attachments/0")),
        "{parsed_body}"
    );
    let mime_body = body_for("http://localhost:8000/mail/mime");
    assert!(mime_body.contains("name=\"body-mime\""), "{mime_body}");
    assert!(!mime_body.contains("attachment-1"), "{mime_body}");
}
