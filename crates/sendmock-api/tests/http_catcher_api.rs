#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod email_provider_requests;
    pub mod scripted_webhook_sender;
    pub mod test_app;
}

use axum::body::Body;
use axum::http::Request;
use sendmock_ops::RecentEventFilter;
use serde_json::{Value, json};
use support::email_provider_requests::send_provider_request;
use support::test_app::{build_test_app, call_api};
use tower::ServiceExt;

/// Sends any method to a catch path and answers the status, headers and body text.
async fn catch(app_router: &axum::Router, method: &str, path: &str) -> (u16, String) {
    let response = app_router
        .clone()
        .oneshot(
            Request::builder()
                .method(method)
                .uri(path)
                .header("x-trace", "abc")
                .body(Body::empty())
                .unwrap_or_else(|error| panic!("a valid request: {error}")),
        )
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    (status, String::from_utf8_lossy(&body_bytes).into_owned())
}

async fn list_requests(app_router: &axum::Router) -> Value {
    call_api(app_router, "GET", "/api/v1/http/requests", None)
        .await
        .1
}

// AC: HC-01.1 HC-02.1
#[tokio::test]
async fn any_method_under_a_bin_is_captured_and_answered_ok_and_the_bin_is_created() {
    let (app_router, _) = build_test_app();

    let (get_status, get_body) =
        catch(&app_router, "GET", "/catch/orders/hooks?event=paid&id=7").await;
    let (delete_status, _) = catch(&app_router, "DELETE", "/catch/orders/hooks/7").await;

    assert_eq!(get_status, 200);
    assert_eq!(get_body, r#"{"ok":true}"#);
    assert_eq!(delete_status, 200);
    let requests = list_requests(&app_router).await;
    assert_eq!(requests["total_count"], 2);
    let newest = &requests["items"][0];
    assert_eq!(newest["method"], "DELETE");
    let oldest = &requests["items"][1];
    assert_eq!(oldest["bin_name"], "orders");
    assert_eq!(oldest["path"], "/catch/orders/hooks");
    assert_eq!(oldest["query"]["event"], "paid");
    assert_eq!(oldest["headers"]["x-trace"], "abc");
    assert_eq!(oldest["response_status"], 200);
    let (_, bins) = call_api(&app_router, "GET", "/api/v1/http/bins", None).await;
    assert_eq!(bins[0]["name"], "orders");
    assert_eq!(bins[0]["request_count"], 2);
}

// AC: HC-01.2 HC-01.3
#[tokio::test]
async fn json_and_multipart_bodies_are_kept_with_downloadable_files_and_fire_http_captured() {
    let (app_router, operation_context) = build_test_app();
    let multipart_body = "--b\r\nContent-Disposition: form-data; name=\"note\"\r\n\r\nhello\r\n--b\r\nContent-Disposition: form-data; name=\"invoice\"; filename=\"42.txt\"\r\nContent-Type: text/plain\r\n\r\nINVOICE 42\r\n--b--\r\n";

    send_provider_request(
        &app_router,
        "/catch/uploads",
        "application/json",
        br#"{"a":1}"#.to_vec(),
    )
    .await;
    send_provider_request(
        &app_router,
        "/catch/uploads",
        "multipart/form-data; boundary=b",
        multipart_body.as_bytes().to_vec(),
    )
    .await;

    let requests = list_requests(&app_router).await;
    let multipart_request = &requests["items"][0];
    assert_eq!(requests["items"][1]["body"], r#"{"a":1}"#);
    assert_eq!(multipart_request["files"][0]["filename"], "42.txt");
    assert_eq!(multipart_request["files"][0]["size_bytes"], 10);
    let request_id = multipart_request["id"].as_str().unwrap_or_default();
    let file_response = app_router
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/api/v1/http/requests/{request_id}/files/0"))
                .body(Body::empty())
                .unwrap_or_else(|error| panic!("a valid request: {error}")),
        )
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let file_bytes = axum::body::to_bytes(file_response.into_body(), usize::MAX)
        .await
        .unwrap_or_default();
    assert_eq!(&file_bytes[..], b"INVOICE 42");
    let captured_events = operation_context
        .event_bus
        .recent_events(&RecentEventFilter {
            created_after_unix_ms: None,
            event_type: Some("http.captured".to_owned()),
            limit: 10,
        });
    assert_eq!(captured_events.len(), 2);
}

// AC: HC-02.1
#[tokio::test]
async fn bins_get_their_preset_reply_names_are_unique_and_the_default_reply_can_change() {
    let (app_router, _) = build_test_app();

    let (_, slack_bin) = call_api(
        &app_router,
        "POST",
        "/api/v1/http/bins",
        Some(&json!({ "name": "alerts", "preset": "slack" })),
    )
    .await;
    let (taken_status, _) = call_api(
        &app_router,
        "POST",
        "/api/v1/http/bins",
        Some(&json!({ "name": "alerts", "preset": null })),
    )
    .await;
    let (_, slack_answer) = catch(&app_router, "POST", "/catch/alerts").await;
    let bin_id = slack_bin["id"].as_str().unwrap_or_default();
    call_api(
        &app_router,
        "PATCH",
        &format!("/api/v1/http/bins/{bin_id}"),
        Some(
            &json!({ "default_response": { "status_code": 202, "headers": {}, "body": "queued" } }),
        ),
    )
    .await;
    let (changed_status, changed_answer) = catch(&app_router, "POST", "/catch/alerts").await;
    let (delete_status, _) = call_api(
        &app_router,
        "DELETE",
        &format!("/api/v1/http/bins/{bin_id}"),
        None,
    )
    .await;

    assert_eq!(slack_bin["preset"], "slack");
    assert_eq!(taken_status, 409);
    assert_eq!(slack_answer, "ok");
    assert_eq!((changed_status, changed_answer.as_str()), (202, "queued"));
    assert_eq!(delete_status, 204);
    assert_eq!(list_requests(&app_router).await["total_count"], 0);
}

// AC: PL-03.1 PL-03.2
#[tokio::test]
async fn wait_for_http_answers_a_matching_request_and_408_without_one() {
    let (app_router, _) = build_test_app();
    catch(&app_router, "POST", "/catch/orders").await;

    let (found_status, found) = call_api(
        &app_router,
        "GET",
        "/api/v1/wait/http?bin=orders&method=POST&timeout=1s",
        None,
    )
    .await;
    let (other_bin_status, _) = call_api(
        &app_router,
        "GET",
        "/api/v1/wait/http?bin=nobody&timeout=300ms",
        None,
    )
    .await;
    let (old_status, _) = call_api(
        &app_router,
        "GET",
        "/api/v1/wait/http?bin=orders&since=2099-01-01T00:00:00Z&timeout=300ms",
        None,
    )
    .await;

    assert_eq!(found_status, 200, "{found}");
    assert_eq!(found["bin_name"], "orders");
    assert_eq!(other_bin_status, 408);
    assert_eq!(old_status, 408);
}

fn response_rule(rule_name: &str, overrides: Value) -> Value {
    let mut response_rule = json!({
        "id": format!("rule-{rule_name}"), "name": rule_name, "is_enabled": true, "method": null,
        "path_glob": "", "filter": null,
        "response": { "status_code": 200, "headers": {}, "body": "default" },
        "delay_min_ms": 0, "delay_max_ms": 0, "failure_rate_percent": 0, "failure_status_code": 503,
    });
    if let (Some(rule_fields), Some(override_fields)) =
        (response_rule.as_object_mut(), overrides.as_object())
    {
        rule_fields.extend(override_fields.clone());
    }
    response_rule
}

async fn create_bin_with_rules(app_router: &axum::Router, rules: Value) -> (String, u16, Value) {
    let (_, bin) = call_api(
        app_router,
        "POST",
        "/api/v1/http/bins",
        Some(&json!({ "name": "shop", "preset": null })),
    )
    .await;
    let bin_id = bin["id"].as_str().unwrap_or_default().to_owned();
    let response = app_router
        .clone()
        .oneshot(
            Request::builder()
                .method("PUT")
                .uri(format!("/api/v1/http/bins/{bin_id}/responses"))
                .header("content-type", "application/json")
                .body(Body::from(rules.to_string()))
                .unwrap_or_else(|error| panic!("a valid request: {error}")),
        )
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    let status = response.status().as_u16();
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_default();
    (
        bin_id,
        status,
        serde_json::from_slice(&body_bytes).unwrap_or(Value::Null),
    )
}

// AC: HC-02.1 HC-02.2
#[tokio::test]
async fn rules_match_in_order_on_method_path_and_conditions_and_echo_the_request() {
    let (app_router, _) = build_test_app();
    let (_, put_status, _) = create_bin_with_rules(
        &app_router,
        json!([
            response_rule("Refunds", json!({
                "method": "POST", "path_glob": "/v1/refunds*",
                "filter": { "field": "header:x-trace", "operator": "equals", "value": "abc" },
                "response": { "status_code": 201, "headers": { "x-refund": "{{ request.query.id }}" }, "body": "{\"refunded\": \"{{ request.query.id }}\"}" },
            })),
            response_rule("Any POST", json!({ "method": "POST" })),
        ]),
    )
    .await;

    let (refund_status, refund_body) =
        catch(&app_router, "POST", "/catch/shop/v1/refunds?id=re_9").await;
    let (any_post_status, any_post_body) =
        catch(&app_router, "POST", "/catch/shop/v1/orders").await;
    let (get_status, get_body) = catch(&app_router, "GET", "/catch/shop/v1/refunds").await;

    assert_eq!(put_status, 200);
    assert_eq!(
        (refund_status, refund_body.as_str()),
        (201, r#"{"refunded": "re_9"}"#)
    );
    assert_eq!((any_post_status, any_post_body.as_str()), (200, "default"));
    assert_eq!((get_status, get_body.as_str()), (200, r#"{"ok":true}"#));
    let newest_requests = list_requests(&app_router).await;
    assert_eq!(newest_requests["items"][2]["matched_rule_name"], "Refunds");
    assert_eq!(
        newest_requests["items"][2]["response_headers"]["x-refund"],
        "re_9"
    );
}

// AC: HC-02.3
#[tokio::test]
async fn a_full_failure_rate_answers_its_status_and_the_delay_holds_the_answer() {
    let (app_router, _) = build_test_app();
    create_bin_with_rules(
        &app_router,
        json!([response_rule("Flaky", json!({ "failure_rate_percent": 100, "failure_status_code": 503, "delay_min_ms": 60, "delay_max_ms": 60 }))]),
    )
    .await;

    let started_at = std::time::Instant::now();
    let (status, body) = catch(&app_router, "POST", "/catch/shop").await;

    assert!(started_at.elapsed() >= std::time::Duration::from_millis(60));
    assert_eq!(
        (status, body.as_str()),
        (503, r#"{"error":"Simulated failure"}"#)
    );
    let captured = &list_requests(&app_router).await["items"][0];
    assert_eq!(captured["is_simulated_failure"], true);
    assert_eq!(captured["duration_ms"], 61);
}

// AC: HC-02.4
#[tokio::test]
async fn rules_are_checked_like_the_editor_and_the_preview_explains_a_mismatch() {
    let (app_router, _) = build_test_app();
    let (bin_id, refused_status, refusal) = create_bin_with_rules(
        &app_router,
        json!([response_rule("Bad path", json!({ "path_glob": "v1/*" }))]),
    )
    .await;
    catch(&app_router, "GET", "/catch/shop/v1/orders").await;
    let request_id = list_requests(&app_router).await["items"][0]["id"].clone();

    let (preview_status, preview) = call_api(
        &app_router,
        "POST",
        &format!("/api/v1/http/bins/{bin_id}/responses/preview"),
        Some(&json!({ "rule": response_rule("Posts", json!({ "method": "POST" })), "request_id": request_id })),
    )
    .await;

    assert_eq!(refused_status, 400, "{refusal}");
    assert_eq!(preview_status, 200, "{preview}");
    assert_eq!(preview["is_match"], false);
    assert_eq!(preview["mismatch_reason"], "Method is GET, not POST");
    assert_eq!(preview["response"]["body"], "default");
}

// AC: HC-01.5
#[tokio::test]
async fn forward_sends_a_captured_request_on_and_answers_what_the_app_said() {
    let webhook_sender = std::sync::Arc::new(
        support::scripted_webhook_sender::ScriptedWebhookSender::answering(&[
            support::scripted_webhook_sender::ScriptedAnswer::Status(202),
        ]),
    );
    let (app_router, _) = support::test_app::build_test_app_with(|operation_context| {
        operation_context.with_webhook_sender(webhook_sender.clone())
    });
    send_provider_request(
        &app_router,
        "/catch/orders",
        "application/json",
        br#"{"order":7}"#.to_vec(),
    )
    .await;
    let request_id = list_requests(&app_router).await["items"][0]["id"].clone();

    let (status, forwarded) = call_api(
        &app_router,
        "POST",
        &format!(
            "/api/v1/http/requests/{}/forward",
            request_id.as_str().unwrap_or_default()
        ),
        Some(&json!({ "url": "http://localhost:8000/hooks" })),
    )
    .await;

    assert_eq!(status, 200, "{forwarded}");
    assert_eq!(forwarded["status_code"], 202);
    let sent_requests = webhook_sender.received_requests();
    assert_eq!(sent_requests[0].url, "http://localhost:8000/hooks");
    assert_eq!(sent_requests[0].method, "POST");
    assert_eq!(sent_requests[0].body, r#"{"order":7}"#);
    assert!(!sent_requests[0].headers.contains_key("host"));
}

// AC: PL-03.5
#[tokio::test]
async fn the_http_sample_is_captured_in_the_slack_bin_like_real_traffic() {
    let (app_router, operation_context) = build_test_app();

    let (status, created) = call_api(
        &app_router,
        "POST",
        "/api/v1/samples/http",
        Some(&json!({})),
    )
    .await;

    assert_eq!(status, 201, "{created}");
    let (_, captured) = call_api(
        &app_router,
        "GET",
        &format!(
            "/api/v1/http/requests/{}",
            created["id"].as_str().unwrap_or_default()
        ),
        None,
    )
    .await;
    assert_eq!(captured["bin_name"], "slack");
    assert!(
        captured["body"]
            .as_str()
            .is_some_and(|body| body.contains("New signup"))
    );
    assert_eq!(
        operation_context
            .event_bus
            .recent_events(&RecentEventFilter {
                created_after_unix_ms: None,
                event_type: Some("http.captured".to_owned()),
                limit: 5
            })
            .len(),
        1
    );
}
