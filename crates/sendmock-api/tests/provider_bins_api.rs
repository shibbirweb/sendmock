#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod email_provider_requests;
    pub mod test_app;
}

use sendmock_ops::sign_twilio_request;
use serde_json::{Value, json};
use support::email_provider_requests::{ProviderReply, send_json, send_provider_request};
use support::test_app::{build_test_app, call_api, call_api_text};

const CALLS_PATH: &str = "/2010-04-01/Accounts/ACtest00000000000000000000000000/Calls.json";
const FORM_CONTENT_TYPE: &str = "application/x-www-form-urlencoded";
const STATUS_CALLBACK_URL: &str = "http://localhost:3999/calls/status";

async fn attach_bin(
    app_router: &axum::Router,
    area: &str,
    provider_key: &str,
    bin_name: &str,
) -> (u16, Value) {
    call_api(
        app_router,
        "PUT",
        &format!("/api/v1/provider-bins/{area}/{provider_key}"),
        Some(&json!({ "bin_name": bin_name })),
    )
    .await
}

/// A rule answering Twilio's Calls.json as Twilio does, with an optional follow-up webhook.
fn calls_rule(follow_up: Value) -> Value {
    json!([{
        "id": "rule-calls", "name": "Calls", "is_enabled": true, "method": "POST",
        "path_glob": "/2010-04-01/Accounts/*/Calls.json", "filter": null,
        "response": {
            "status_code": 201,
            "headers": { "content-type": "application/json" },
            "body": "{\"sid\": \"CA00000000000000000000000000000001\", \"status\": \"queued\"}",
        },
        "delay_min_ms": 0, "delay_max_ms": 0, "failure_rate_percent": 0, "failure_status_code": 503,
        "follow_up": follow_up,
    }])
}

/// The Twilio provider sends its unmatched requests to `twilio-gaps`, which has the Calls rule.
async fn attach_twilio_bin_with_rule(app_router: &axum::Router, follow_up: Value) -> String {
    let (status, attached) = attach_bin(app_router, "sms", "twilio", "twilio-gaps").await;
    assert_eq!(status, 200, "{attached}");
    let bin_id = attached["bin_id"].as_str().unwrap_or_default().to_owned();
    let (rules_status, rules) = call_api(
        app_router,
        "PUT",
        &format!("/api/v1/http/bins/{bin_id}/responses"),
        Some(&calls_rule(follow_up)),
    )
    .await;
    assert_eq!(rules_status, 200, "{rules}");
    bin_id
}

async fn place_call(router: &axum::Router, path: &str) -> ProviderReply {
    let form_body = format!(
        "To=%2B14155550100&From=%2B15005550006&Url=http%3A%2F%2Fdemo.twilio.com%2Fdocs%2Fvoice.xml&StatusCallback={}",
        STATUS_CALLBACK_URL.replace(':', "%3A").replace('/', "%2F")
    );
    send_provider_request(router, path, FORM_CONTENT_TYPE, form_body.into_bytes()).await
}

async fn list_bin_requests(app_router: &axum::Router, bin_id: &str) -> Vec<Value> {
    let (_, requests_page) = call_api(
        app_router,
        "GET",
        &format!("/api/v1/http/requests?bin_id={bin_id}"),
        None,
    )
    .await;
    requests_page["items"]
        .as_array()
        .cloned()
        .unwrap_or_default()
}

// AC: PL-21.1
#[tokio::test]
async fn a_provider_bin_is_attached_listed_and_detached_and_the_bin_is_made_if_new() {
    let (app_router, _) = build_test_app();

    let (attach_status, attached) = attach_bin(&app_router, "sms", "twilio", "twilio-gaps").await;
    let (_, listed) = call_api(&app_router, "GET", "/api/v1/provider-bins", None).await;
    let (_, bins) = call_api(&app_router, "GET", "/api/v1/http/bins", None).await;
    let (unknown_status, _) = attach_bin(&app_router, "sms", "no_such_provider", "x").await;
    let (bad_area_status, _) = attach_bin(&app_router, "storage", "twilio", "x").await;
    let (gateway_status, _) = attach_bin(&app_router, "payments", "stripe", "stripe-gaps").await;
    let (detach_status, _) = call_api(
        &app_router,
        "DELETE",
        "/api/v1/provider-bins/sms/twilio",
        None,
    )
    .await;
    let (_, listed_after) = call_api(&app_router, "GET", "/api/v1/provider-bins", None).await;

    assert_eq!(attach_status, 200, "{attached}");
    assert_eq!(attached["bin_name"], "twilio-gaps");
    assert_eq!(listed[0]["provider_key"], "twilio");
    assert_eq!(listed[0]["area"], "sms");
    assert!(
        bins.as_array()
            .is_some_and(|bins| bins.iter().any(|bin| bin["name"] == "twilio-gaps"))
    );
    assert_eq!(unknown_status, 404);
    assert_eq!(bad_area_status, 400);
    assert_eq!(gateway_status, 200);
    assert_eq!(detach_status, 204);
    assert_eq!(listed_after.as_array().map(Vec::len), Some(1));
}

// AC: PL-21.2
// AC: PL-21.5
#[tokio::test]
async fn an_unmatched_twilio_path_is_captured_in_the_bin_and_answered_by_its_rule() {
    let (app_router, _) = build_test_app();
    let bin_id = attach_twilio_bin_with_rule(&app_router, Value::Null).await;

    let reply = place_call(&app_router, &format!("/providers/twilio{CALLS_PATH}")).await;

    assert_eq!(reply.status, 201, "{}", reply.body_text);
    assert_eq!(reply.body["sid"], "CA00000000000000000000000000000001");
    let captured = list_bin_requests(&app_router, &bin_id).await;
    assert_eq!(captured[0]["provider_key"], "twilio");
    assert_eq!(captured[0]["matched_rule_name"], "Calls");
    assert_eq!(captured[0]["path"], CALLS_PATH);
    let (_, log_page) = call_api(&app_router, "GET", "/api/v1/logs/http?api=twilio", None).await;
    let logged = &log_page["items"][0];
    assert_eq!(logged["path"], format!("/providers/twilio{CALLS_PATH}"));
    assert_eq!(logged["response_status"], 201);
    assert_eq!(
        logged["catcher_answer"],
        json!({ "bin_name": "twilio-gaps", "rule_name": "Calls" })
    );
}

// AC: PL-21.2
#[tokio::test]
async fn built_in_operations_answer_first_and_catch_urls_and_the_404_keep_working() {
    let (app_router, _) = build_test_app();
    let messages_path =
        "/providers/twilio/2010-04-01/Accounts/ACtest00000000000000000000000000/Messages.json";
    let unattached_reply = place_call(&app_router, &format!("/providers/twilio{CALLS_PATH}")).await;
    let bin_id = attach_twilio_bin_with_rule(&app_router, Value::Null).await;

    let message_reply = send_provider_request(
        &app_router,
        messages_path,
        FORM_CONTENT_TYPE,
        b"To=%2B14155550100&From=%2B15005550006&Body=Hi".to_vec(),
    )
    .await;
    let catch_reply = send_json(&app_router, "/catch/twilio-gaps/direct", &json!({})).await;

    assert_eq!(
        unattached_reply.status, 404,
        "{}",
        unattached_reply.body_text
    );
    assert_eq!(message_reply.status, 201, "{}", message_reply.body_text);
    assert!(
        message_reply.body["sid"]
            .as_str()
            .is_some_and(|sid| sid.starts_with("SM"))
    );
    assert_eq!(catch_reply.status, 200, "{}", catch_reply.body_text);
    let captured = list_bin_requests(&app_router, &bin_id).await;
    assert_eq!(captured.len(), 1, "only the catch URL request is captured");
    assert_eq!(captured[0]["provider_key"], Value::Null);
}

// AC: PL-21.3
#[tokio::test]
async fn a_custom_provider_without_operations_serves_its_vendor_on_the_provider_port() {
    let (app_router, operation_context) = build_test_app();
    let provider_port_router = sendmock_api::build_provider_port_router(&operation_context, None);
    let (created_status, created) = call_api(
        &app_router,
        "POST",
        "/api/v1/sms/providers",
        Some(&json!({ "name": "Acme Voice", "key": "acme_voice", "start_from": null })),
    )
    .await;
    assert_eq!(created_status, 201, "{created}");
    let (_, attached) = attach_bin(&app_router, "sms", "acme_voice", "acme-voice").await;

    let reply = send_json(
        &provider_port_router,
        "/v2/calls",
        &json!({ "to": "+14155550100" }),
    )
    .await;

    assert_eq!(reply.status, 200, "{}", reply.body_text);
    let captured =
        list_bin_requests(&app_router, attached["bin_id"].as_str().unwrap_or_default()).await;
    assert_eq!(captured[0]["provider_key"], "acme_voice");
    assert_eq!(captured[0]["path"], "/v2/calls");
}

// AC: PL-21.4
#[tokio::test]
async fn a_rule_queues_a_signed_follow_up_webhook_to_the_url_in_the_request_after_its_delay() {
    let (app_router, operation_context) = build_test_app();
    let follow_up = json!({
        "url": "{{ request.form.StatusCallback }}", "endpoint_id": null,
        "template_id": "twilio.status_callback", "delay_ms": 1500,
    });
    attach_twilio_bin_with_rule(&app_router, follow_up).await;

    let reply = place_call(&app_router, &format!("/providers/twilio{CALLS_PATH}")).await;

    assert_eq!(reply.status, 201, "{}", reply.body_text);
    let (_, deliveries) = call_api(&app_router, "GET", "/api/v1/webhooks/deliveries", None).await;
    let delivery = &deliveries["items"][0];
    assert_eq!(delivery["endpoint_name"], "Bin twilio-gaps: Calls");
    assert_eq!(delivery["url"], STATUS_CALLBACK_URL);
    assert_eq!(delivery["status"], "pending");
    let now_unix_ms = 1_767_225_600_000;
    let repository = &operation_context.webhook_delivery_repository;
    let not_yet_due = repository
        .list_due_deliveries(now_unix_ms, 10)
        .await
        .unwrap_or_default();
    let due = repository
        .list_due_deliveries(now_unix_ms + 1_500, 10)
        .await
        .unwrap_or_default();
    assert!(not_yet_due.is_empty(), "the follow-up waits for its delay");
    let rendered: Value =
        serde_json::from_str(due[0].rendered_request_json.as_deref().unwrap_or("null"))
            .unwrap_or_default();
    let form_fields: Value = serde_urlencoded::from_str::<Vec<(String, String)>>(
        rendered["body"].as_str().unwrap_or_default(),
    )
    .map(|pairs| {
        pairs
            .into_iter()
            .map(|(name, value)| (name, Value::from(value)))
            .collect()
    })
    .unwrap_or_default();
    assert_eq!(
        rendered["headers"]["x-twilio-signature"],
        sign_twilio_request(STATUS_CALLBACK_URL, &form_fields, "twilio-test-token")
    );
}

// AC: PL-21.1
#[tokio::test]
async fn the_seed_file_attaches_a_bin_to_a_provider_and_exports_it() {
    let (app_router, _) = build_test_app();
    let seed_toml = r#"
[[http.provider_bins]]
area = "sms"
provider = "twilio"
bin = "twilio-gaps"
"#;

    let (apply_status, applied) = call_api(
        &app_router,
        "POST",
        "/api/v1/seed/apply",
        Some(&json!({ "seed_toml": seed_toml })),
    )
    .await;
    let (_, listed) = call_api(&app_router, "GET", "/api/v1/provider-bins", None).await;
    let (_, _, exported_seed) = call_api_text(&app_router, "/api/v1/seed/export").await;

    assert_eq!(apply_status, 200, "{applied}");
    assert_eq!(listed[0]["bin_name"], "twilio-gaps");
    assert!(
        exported_seed.contains("[[http.provider_bins]]"),
        "{exported_seed}"
    );
    assert!(
        exported_seed.contains("bin = \"twilio-gaps\""),
        "{exported_seed}"
    );
}
