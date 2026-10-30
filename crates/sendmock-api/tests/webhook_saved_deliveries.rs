#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod manual_clock;
    pub mod scripted_webhook_sender;
    pub mod test_app;
    pub mod webhook_samples;
    pub mod webhook_send_fixture;
}

use serde_json::{Value, json};
use support::scripted_webhook_sender::ScriptedAnswer;
use support::test_app::call_api;
use support::webhook_samples::endpoint_input;
use support::webhook_send_fixture::{WebhookSendFixture, build_send_fixture, global_variable};

const GREETING_BODY: &str = r#"{"greeting": "{{ vars.greeting }}"}"#;

fn id_of(api_answer: &Value) -> String {
    api_answer["id"].as_str().unwrap_or_default().to_owned()
}

fn raw_body_settings(raw_body: &str) -> Value {
    json!({ "body_mode": "raw", "raw_content_type": "application/json", "raw_body": raw_body })
}

/// An endpoint whose body prints a global variable, and one sent delivery of it; answers the
/// endpoint, the delivery and the variable ids.
async fn send_greeting(fixture: &WebhookSendFixture) -> (String, String, String) {
    let greeting_variable = fixture
        .create_variable(&global_variable("greeting", "text", "hello"))
        .await;
    let endpoint_id = fixture
        .create_endpoint(raw_body_settings(GREETING_BODY))
        .await;
    let manual_delivery = fixture.send_manually(&endpoint_id, &json!({})).await;
    fixture.run_due().await;
    (
        endpoint_id,
        id_of(&manual_delivery),
        id_of(&greeting_variable),
    )
}

async fn change_greeting(fixture: &WebhookSendFixture, variable_id: &str, greeting: &str) {
    let (status, updated_variable) = call_api(
        &fixture.app_router,
        "PATCH",
        &format!("/api/v1/webhooks/variables/{variable_id}"),
        Some(&global_variable("greeting", "text", greeting)),
    )
    .await;
    assert_eq!(status, 200, "{updated_variable}");
}

async fn save_delivery(fixture: &WebhookSendFixture, delivery_id: &str, saved_name: &str) -> Value {
    let (status, saved_delivery) = fixture
        .post(
            "/api/v1/webhooks/saved",
            &json!({ "name": saved_name, "delivery_id": delivery_id }),
        )
        .await;
    assert_eq!(status, 201, "{saved_delivery}");
    saved_delivery
}

async fn list_saved(fixture: &WebhookSendFixture) -> Vec<Value> {
    let (status, saved_list) =
        call_api(&fixture.app_router, "GET", "/api/v1/webhooks/saved", None).await;
    assert_eq!(status, 200, "{saved_list}");
    saved_list.as_array().cloned().unwrap_or_default()
}

async fn send_saved(fixture: &WebhookSendFixture, saved_id: &str, send_request: &Value) -> Value {
    let (status, sent_delivery) = fixture
        .post(
            &format!("/api/v1/webhooks/saved/{saved_id}/send"),
            send_request,
        )
        .await;
    assert_eq!(status, 200, "{sent_delivery}");
    sent_delivery
}

async fn create_other_endpoint(fixture: &WebhookSendFixture) -> String {
    fixture
        .create_endpoint(json!({
            "url": "http://localhost:4000/other",
            "body_mode": "raw", "raw_content_type": "application/json",
            "raw_body": r#"{"other": "{{ vars.greeting }}"}"#,
        }))
        .await
}

// AC: WH-10.1
#[tokio::test]
async fn a_sent_delivery_is_saved_with_a_name_and_its_request_without_signatures() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200)]);
    let (endpoint_id, delivery_id, _) = send_greeting(&fixture).await;

    let saved_delivery = save_delivery(&fixture, &delivery_id, "  Greeting webhook ").await;

    assert_eq!(saved_delivery["name"], "Greeting webhook");
    assert_eq!(saved_delivery["endpoint_id"], json!(endpoint_id));
    assert_eq!(saved_delivery["template_id"], "native");
    assert!(saved_delivery["event_type"].is_string(), "{saved_delivery}");
    assert_eq!(saved_delivery["request"]["method"], "POST");
    assert_eq!(
        saved_delivery["request"]["url"],
        "http://localhost:3000/hooks"
    );
    assert_eq!(
        saved_delivery["request"]["body"],
        r#"{"greeting": "hello"}"#
    );
    let saved_headers = saved_delivery["request"]["headers"]
        .as_object()
        .cloned()
        .unwrap_or_default();
    assert!(
        saved_headers
            .keys()
            .all(|header_name| !header_name.starts_with("webhook-")),
        "{saved_headers:?}"
    );
    assert_eq!(list_saved(&fixture).await, vec![saved_delivery]);
}

// AC: WH-10.1
#[tokio::test]
async fn a_composer_request_is_saved_from_the_delivery_it_sent() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200)]);
    let endpoint_id = fixture.create_endpoint(json!({})).await;
    let mut written_request = endpoint_input("Composer");
    written_request["url"] = json!("http://localhost:4000/composed");
    written_request["method"] = json!("PUT");
    if let (Some(request_fields), Some(raw_fields)) = (
        written_request.as_object_mut(),
        raw_body_settings(r#"{"composed": true}"#).as_object(),
    ) {
        request_fields.extend(raw_fields.clone());
    }
    let composer_delivery = fixture
        .send_manually(&endpoint_id, &json!({ "request": written_request }))
        .await;

    let saved_delivery = save_delivery(&fixture, &id_of(&composer_delivery), "Composed").await;

    assert_eq!(saved_delivery["request"]["method"], "PUT");
    assert_eq!(
        saved_delivery["request"]["url"],
        "http://localhost:4000/composed"
    );
    assert_eq!(saved_delivery["request"]["body"], r#"{"composed": true}"#);
}

// AC: WH-10.1
#[tokio::test]
async fn saved_deliveries_survive_reset_and_can_still_be_sent() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200), ScriptedAnswer::Status(200)]);
    let (endpoint_id, delivery_id, _) = send_greeting(&fixture).await;
    let saved_delivery = save_delivery(&fixture, &delivery_id, "Kept").await;

    let (reset_status, _) = fixture.post("/api/v1/reset", &json!({})).await;
    let (_, delivery_page) = call_api(
        &fixture.app_router,
        "GET",
        "/api/v1/webhooks/deliveries",
        None,
    )
    .await;
    let sent_delivery = send_saved(
        &fixture,
        &id_of(&saved_delivery),
        &json!({ "endpoint_id": endpoint_id, "rerender": false }),
    )
    .await;

    assert_eq!(reset_status, 204);
    assert_eq!(delivery_page["total_count"], 0, "{delivery_page}");
    assert_eq!(list_saved(&fixture).await, vec![saved_delivery]);
    assert_eq!(sent_delivery["status"], "pending");
}

#[tokio::test]
async fn a_delivery_that_never_rendered_has_nothing_to_save() {
    let fixture = build_send_fixture(&[]);
    let endpoint_id = fixture
        .create_endpoint(json!({ "headers": { "X-Token": "{{ vars.missing }}" } }))
        .await;
    let failed_delivery = fixture.send_manually(&endpoint_id, &json!({})).await;

    let (status, error_body) = fixture
        .post(
            "/api/v1/webhooks/saved",
            &json!({ "name": "Broken", "delivery_id": id_of(&failed_delivery) }),
        )
        .await;

    assert_eq!(status, 409, "{error_body}");
    assert_eq!(error_body["error"]["code"], "nothing_to_save");
}

#[tokio::test]
async fn saving_needs_a_known_delivery_and_a_name() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200)]);
    let (_, delivery_id, _) = send_greeting(&fixture).await;

    let (unknown_status, _) = fixture
        .post(
            "/api/v1/webhooks/saved",
            &json!({ "name": "Ghost", "delivery_id": "01JB7T9Q2R5W8X3Y6Z1A4B7C9D" }),
        )
        .await;
    let (unnamed_status, _) = fixture
        .post(
            "/api/v1/webhooks/saved",
            &json!({ "name": "  ", "delivery_id": delivery_id }),
        )
        .await;

    assert_eq!(unknown_status, 404);
    assert_eq!(unnamed_status, 400);
}

// AC: WH-10.4
#[tokio::test]
async fn saved_deliveries_list_newest_first_and_are_renamed_and_deleted() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200)]);
    let (_, delivery_id, _) = send_greeting(&fixture).await;
    let first_saved = save_delivery(&fixture, &delivery_id, "First").await;
    let second_saved = save_delivery(&fixture, &delivery_id, "Second").await;
    let first_path = format!("/api/v1/webhooks/saved/{}", id_of(&first_saved));

    let listed_names: Vec<Value> = list_saved(&fixture)
        .await
        .iter()
        .map(|saved_delivery| saved_delivery["name"].clone())
        .collect();
    let (rename_status, renamed_delivery) = call_api(
        &fixture.app_router,
        "PATCH",
        &first_path,
        Some(&json!({ "name": "Order webhook, missing SKU" })),
    )
    .await;
    let (blank_rename_status, _) = call_api(
        &fixture.app_router,
        "PATCH",
        &first_path,
        Some(&json!({ "name": "" })),
    )
    .await;
    let (delete_status, _) = call_api(&fixture.app_router, "DELETE", &first_path, None).await;
    let (delete_again_status, _) = call_api(&fixture.app_router, "DELETE", &first_path, None).await;

    assert_eq!(listed_names, vec![json!("Second"), json!("First")]);
    assert_eq!(rename_status, 200, "{renamed_delivery}");
    assert_eq!(renamed_delivery["name"], "Order webhook, missing SKU");
    assert_eq!(blank_rename_status, 400);
    assert_eq!(delete_status, 204);
    assert_eq!(delete_again_status, 404);
    assert_eq!(list_saved(&fixture).await, vec![second_saved]);
}

// AC: WH-10.2
#[tokio::test]
async fn sending_as_is_goes_to_the_picked_endpoint_with_the_saved_request() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200), ScriptedAnswer::Status(200)]);
    let (_, delivery_id, variable_id) = send_greeting(&fixture).await;
    let saved_delivery = save_delivery(&fixture, &delivery_id, "Greeting").await;
    change_greeting(&fixture, &variable_id, "changed").await;
    let other_endpoint_id = create_other_endpoint(&fixture).await;

    let sent_delivery = send_saved(
        &fixture,
        &id_of(&saved_delivery),
        &json!({ "endpoint_id": other_endpoint_id, "rerender": false }),
    )
    .await;
    fixture.run_due().await;

    assert_eq!(sent_delivery["endpoint_id"], json!(other_endpoint_id));
    assert_eq!(sent_delivery["trigger"], "manual");
    let sent_requests = fixture.sent_requests();
    assert_eq!(sent_requests.len(), 2);
    assert_eq!(sent_requests[1].url, "http://localhost:4000/other");
    assert_eq!(sent_requests[1].body, r#"{"greeting": "hello"}"#);
    assert!(sent_requests[1].headers.contains_key("webhook-signature"));
    assert_ne!(
        sent_requests[1].headers.get("webhook-id"),
        sent_requests[0].headers.get("webhook-id")
    );
}

// AC: WH-10.2
#[tokio::test]
async fn sending_re_rendered_uses_the_picked_endpoint_and_variables_as_they_are_now() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200), ScriptedAnswer::Status(200)]);
    let (_, delivery_id, variable_id) = send_greeting(&fixture).await;
    let saved_delivery = save_delivery(&fixture, &delivery_id, "Greeting").await;
    change_greeting(&fixture, &variable_id, "changed").await;
    let other_endpoint_id = create_other_endpoint(&fixture).await;

    send_saved(
        &fixture,
        &id_of(&saved_delivery),
        &json!({ "endpoint_id": other_endpoint_id, "rerender": true }),
    )
    .await;
    fixture.run_due().await;

    assert_eq!(fixture.last_sent_body(), r#"{"other": "changed"}"#);
}

#[tokio::test]
async fn sending_needs_a_known_saved_delivery_and_endpoint() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200)]);
    let (endpoint_id, delivery_id, _) = send_greeting(&fixture).await;
    let saved_delivery = save_delivery(&fixture, &delivery_id, "Greeting").await;

    let (unknown_endpoint_status, error_body) = fixture
        .post(
            &format!("/api/v1/webhooks/saved/{}/send", id_of(&saved_delivery)),
            &json!({ "endpoint_id": "01JB7T9Q2R5W8X3Y6Z1A4B7C9D", "rerender": false }),
        )
        .await;
    let (unknown_saved_status, _) = fixture
        .post(
            "/api/v1/webhooks/saved/01JB7T9Q2R5W8X3Y6Z1A4B7C9D/send",
            &json!({ "endpoint_id": endpoint_id, "rerender": false }),
        )
        .await;

    assert_eq!(unknown_endpoint_status, 400, "{error_body}");
    assert_eq!(unknown_saved_status, 404);
}

// AC: WH-10.2
#[tokio::test]
async fn a_saved_delivery_becomes_a_custom_template() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200)]);
    let (_, delivery_id, _) = send_greeting(&fixture).await;
    let saved_delivery = save_delivery(&fixture, &delivery_id, "Greeting").await;

    let (status, template_summary) = fixture
        .post(
            &format!("/api/v1/webhooks/saved/{}/template", id_of(&saved_delivery)),
            &json!({ "name": "Greeting template" }),
        )
        .await;
    let (_, template_detail) = call_api(
        &fixture.app_router,
        "GET",
        &format!("/api/v1/webhooks/templates/{}", id_of(&template_summary)),
        None,
    )
    .await;

    assert_eq!(status, 201, "{template_summary}");
    assert_eq!(template_summary["name"], "Greeting template");
    assert_eq!(template_summary["source"], "custom");
    assert_eq!(
        template_summary["events"],
        json!([saved_delivery["event_type"]])
    );
    assert_eq!(template_detail["method"], "POST");
    assert_eq!(template_detail["content_type"], "application/json");
    assert_eq!(template_detail["body_template"], r#"{"greeting": "hello"}"#);
}

#[tokio::test]
async fn deleting_the_endpoint_keeps_the_saved_delivery_without_it() {
    let fixture = build_send_fixture(&[ScriptedAnswer::Status(200)]);
    let (endpoint_id, delivery_id, _) = send_greeting(&fixture).await;
    save_delivery(&fixture, &delivery_id, "Greeting").await;

    let (delete_status, _) = call_api(
        &fixture.app_router,
        "DELETE",
        &format!("/api/v1/webhooks/endpoints/{endpoint_id}"),
        None,
    )
    .await;

    assert_eq!(delete_status, 204);
    let saved_list = list_saved(&fixture).await;
    assert_eq!(saved_list.len(), 1);
    assert_eq!(saved_list[0]["endpoint_id"], Value::Null);
}
