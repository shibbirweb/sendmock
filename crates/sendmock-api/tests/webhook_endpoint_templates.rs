#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use sendmock_ops::{
    AppEvent, DeliveryOrder, DeliveryTrigger, OperationContext, RecordedHttpRequest,
    enqueue_webhook_delivery,
};
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use support::webhook_samples::endpoint_input;

const ENDPOINTS_PATH: &str = "/api/v1/webhooks/endpoints";
const TEMPLATES_PATH: &str = "/api/v1/webhooks/templates";

fn endpoint_with(endpoint_name: &str, changed_settings: Value) -> Value {
    let mut endpoint_body = endpoint_input(endpoint_name);
    if let (Some(endpoint_fields), Some(changed_entries)) =
        (endpoint_body.as_object_mut(), changed_settings.as_object())
    {
        endpoint_fields.extend(changed_entries.clone());
    }
    endpoint_body
}

async fn create_endpoint(app_router: &axum::Router, endpoint_body: Value) -> String {
    let (status, created_endpoint) =
        call_api(app_router, "POST", ENDPOINTS_PATH, Some(&endpoint_body)).await;
    assert_eq!(status, 201, "{created_endpoint}");
    created_endpoint["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned()
}

async fn patch_endpoint(app_router: &axum::Router, endpoint_id: &str, changed_settings: Value) {
    let (status, changed_endpoint) = call_api(
        app_router,
        "PATCH",
        &format!("{ENDPOINTS_PATH}/{endpoint_id}"),
        Some(&changed_settings),
    )
    .await;
    assert_eq!(status, 200, "{changed_endpoint}");
}

/// A custom template whose JSON body is `body_template`, answering its id.
async fn create_custom_template(app_router: &axum::Router, body_template: &str) -> String {
    let (status, created_template) = call_api(
        app_router,
        "POST",
        TEMPLATES_PATH,
        Some(&json!({ "name": "Order webhook" })),
    )
    .await;
    assert_eq!(status, 201, "{created_template}");
    let template_id = created_template["id"]
        .as_str()
        .unwrap_or_default()
        .to_owned();
    edit_template_body(app_router, &template_id, body_template).await;
    template_id
}

async fn edit_template_body(app_router: &axum::Router, template_id: &str, body_template: &str) {
    let (status, edited_template) = call_api(
        app_router,
        "PATCH",
        &format!("{TEMPLATES_PATH}/{template_id}"),
        Some(&json!({
            "method": "POST", "content_type": "application/json",
            "header_templates": { "X-Source": "template" }, "body_template": body_template,
        })),
    )
    .await;
    assert_eq!(status, 200, "{edited_template}");
}

/// Queues a delivery of an `email.received` event and answers the request it would send.
async fn queue_delivery(
    operation_context: &OperationContext,
    endpoint_id: &str,
) -> RecordedHttpRequest {
    let stored_endpoint = operation_context
        .webhook_endpoint_repository
        .find_endpoint(endpoint_id)
        .await
        .ok()
        .flatten()
        .unwrap_or_else(|| panic!("the endpoint {endpoint_id} exists"));
    let delivery_order = DeliveryOrder {
        app_event: AppEvent {
            id: "evt_template".to_owned(),
            event_type: "email.received".to_owned(),
            created_at: "2026-01-01T00:00:00Z".to_owned(),
            data: json!({ "subject": "Welcome" }),
        },
        subject_id: None,
        rule_id: None,
        delivery_trigger: DeliveryTrigger::Automatic,
        send_time_values: serde_json::Map::new(),
    };
    let queued_delivery =
        enqueue_webhook_delivery(operation_context, &stored_endpoint, delivery_order)
            .await
            .unwrap_or_else(|error| panic!("the delivery is queued: {error}"));
    serde_json::from_str(
        queued_delivery
            .rendered_request_json
            .as_deref()
            .unwrap_or_else(|| panic!("the delivery rendered: {queued_delivery:?}")),
    )
    .unwrap_or_else(|error| panic!("the stored request parses: {error}"))
}

async fn preview_request(app_router: &axum::Router, preview_body: Value) -> Value {
    let (status, preview_result) = call_api(
        app_router,
        "POST",
        &format!("{ENDPOINTS_PATH}/preview"),
        Some(&preview_body),
    )
    .await;
    assert_eq!(status, 200, "{preview_result}");
    preview_result
}

fn read_json_body(body: &str) -> Value {
    serde_json::from_str(body).unwrap_or_else(|error| panic!("{body} is JSON: {error}"))
}

// AC: WH-09.2
#[tokio::test]
async fn a_linked_endpoint_follows_a_template_edit_and_a_detached_one_keeps_its_copy() {
    let (app_router, operation_context) = build_test_app();
    let template_id = create_custom_template(&app_router, r#"{"version": "one"}"#).await;
    let linked_endpoint_id = create_endpoint(
        &app_router,
        endpoint_with("Linked app", json!({ "template_id": template_id })),
    )
    .await;
    let detached_endpoint_id = create_endpoint(
        &app_router,
        endpoint_with(
            "Detached app",
            json!({ "template_id": template_id, "template_mode": "detached" }),
        ),
    )
    .await;

    edit_template_body(&app_router, &template_id, r#"{"version": "two"}"#).await;
    let linked_request = queue_delivery(&operation_context, &linked_endpoint_id).await;
    let detached_request = queue_delivery(&operation_context, &detached_endpoint_id).await;
    let detached_preview =
        preview_request(&app_router, json!({ "endpoint_id": detached_endpoint_id })).await;

    assert_eq!(read_json_body(&linked_request.body)["version"], "two");
    assert_eq!(read_json_body(&detached_request.body)["version"], "one");
    assert_eq!(
        read_json_body(detached_preview["body"].as_str().unwrap_or_default())["version"],
        "one"
    );
}

// AC: WH-09.2
#[tokio::test]
async fn a_detached_endpoint_keeps_its_copy_through_edits_until_it_links_again() {
    let (app_router, operation_context) = build_test_app();
    let template_id = create_custom_template(&app_router, r#"{"version": "one"}"#).await;
    let endpoint_id = create_endpoint(
        &app_router,
        endpoint_with(
            "Orders app",
            json!({ "template_id": template_id, "template_mode": "detached" }),
        ),
    )
    .await;
    edit_template_body(&app_router, &template_id, r#"{"version": "two"}"#).await;

    patch_endpoint(&app_router, &endpoint_id, json!({ "name": "Renamed app" })).await;
    let renamed_request = queue_delivery(&operation_context, &endpoint_id).await;
    patch_endpoint(
        &app_router,
        &endpoint_id,
        json!({ "template_mode": "linked" }),
    )
    .await;
    patch_endpoint(
        &app_router,
        &endpoint_id,
        json!({ "template_mode": "detached" }),
    )
    .await;
    edit_template_body(&app_router, &template_id, r#"{"version": "three"}"#).await;
    let detached_again_request = queue_delivery(&operation_context, &endpoint_id).await;

    assert_eq!(read_json_body(&renamed_request.body)["version"], "one");
    assert_eq!(
        read_json_body(&detached_again_request.body)["version"],
        "two"
    );
}

#[tokio::test]
async fn template_mode_layers_the_endpoints_headers_and_extra_fields_over_the_template() {
    let (app_router, _) = build_test_app();
    let template_id =
        create_custom_template(&app_router, r#"{"text": "{{ data.subject }}"}"#).await;

    let preview_result = preview_request(
        &app_router,
        json!({
            "endpoint": endpoint_with("Orders app", json!({
                "template_id": template_id,
                "headers": { "X-Team": "ops" },
                "extra_fields": { "environment": "{{ vars.env }}" },
            })),
            "variables": { "env": "local" },
        }),
    )
    .await;
    let sent_body = read_json_body(preview_result["body"].as_str().unwrap_or_default());

    assert_eq!(preview_result["problems"], json!([]));
    assert_eq!(sent_body["environment"], "local");
    assert!(sent_body["text"].is_string(), "{sent_body}");
    assert_eq!(
        preview_result["headers"]["content-type"],
        "application/json"
    );
    assert_eq!(preview_result["headers"]["x-source"], "template");
    assert_eq!(preview_result["headers"]["x-team"], "ops");
}

#[tokio::test]
async fn an_endpoint_header_replaces_the_template_header_of_the_same_name() {
    let (app_router, _) = build_test_app();
    let template_id = create_custom_template(&app_router, "{}").await;

    let preview_result = preview_request(
        &app_router,
        json!({
            "endpoint": endpoint_with("Orders app", json!({
                "template_id": template_id, "headers": { "X-Source": "endpoint" },
            })),
        }),
    )
    .await;

    assert_eq!(preview_result["headers"]["x-source"], "endpoint");
}

#[tokio::test]
async fn the_native_template_sends_the_event_with_extra_fields_on_its_root() {
    let (app_router, operation_context) = build_test_app();
    let endpoint_id = create_endpoint(
        &app_router,
        endpoint_with(
            "Orders app",
            json!({ "extra_fields": { "environment": "staging" } }),
        ),
    )
    .await;

    let sent_request = queue_delivery(&operation_context, &endpoint_id).await;
    let sent_body = read_json_body(&sent_request.body);

    assert_eq!(sent_body["id"], "evt_template");
    assert_eq!(sent_body["type"], "email.received");
    assert_eq!(sent_body["data"]["subject"], "Welcome");
    assert_eq!(sent_body["environment"], "staging");
}

#[tokio::test]
async fn a_template_problem_is_reported_against_the_body() {
    let (app_router, _) = build_test_app();
    let template_id = create_custom_template(&app_router, "{}").await;

    let preview_result = preview_request(
        &app_router,
        json!({
            "endpoint": endpoint_with("Orders app", json!({
                "template_id": template_id,
                "extra_fields": { "token": "{{ vars.missing_token }}" },
            })),
        }),
    )
    .await;
    let problems = preview_result["problems"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    assert!(!problems.is_empty(), "{preview_result}");
    assert!(
        problems
            .iter()
            .all(|problem| problem["source"] == "body" && problem["severity"] == "error"),
        "{problems:?}"
    );
}

#[tokio::test]
async fn an_endpoint_with_an_unknown_template_is_refused() {
    let (app_router, _) = build_test_app();

    let (status, error_body) = call_api(
        &app_router,
        "POST",
        ENDPOINTS_PATH,
        Some(&endpoint_with(
            "Orders app",
            json!({ "template_id": "custom.gone" }),
        )),
    )
    .await;

    assert_eq!(status, 400, "{error_body}");
    assert_eq!(error_body["error"]["field"], "template_id");
}

// AC: WH-09.1
#[tokio::test]
async fn an_endpoint_is_saved_as_a_template_with_its_headers_and_extra_fields() {
    let (app_router, _) = build_test_app();
    let endpoint_id = create_endpoint(
        &app_router,
        endpoint_with(
            "Orders app",
            json!({
                "template_id": "slack.incoming_webhook",
                "headers": { "X-Team": "ops" },
                "extra_fields": { "environment": "{{ vars.env }}" },
            }),
        ),
    )
    .await;

    let (status, saved_template) = call_api(
        &app_router,
        "POST",
        &format!("{ENDPOINTS_PATH}/{endpoint_id}/save-as-template"),
        Some(&json!({ "name": "Ops alert" })),
    )
    .await;
    let (_, saved_detail) = call_api(
        &app_router,
        "GET",
        &format!(
            "{TEMPLATES_PATH}/{}",
            saved_template["id"].as_str().unwrap_or_default()
        ),
        None,
    )
    .await;

    assert_eq!(status, 201, "{saved_template}");
    assert_eq!(saved_template["id"], "custom.ops_alert");
    assert_eq!(saved_template["source"], "custom");
    assert_eq!(saved_template["service"], "Slack");
    assert_eq!(
        saved_template["description"],
        "Saved from the endpoint \"Orders app\"."
    );
    assert_eq!(saved_template["events"][0], "email.received");
    assert_eq!(saved_detail["header_templates"]["X-Team"], "ops");
    assert!(
        saved_detail["body_template"]
            .as_str()
            .unwrap_or_default()
            .contains(r#""environment": "{{ vars.env }}""#),
        "{saved_detail}"
    );
}

// AC: WH-09.1
#[tokio::test]
async fn saving_as_a_template_needs_a_name_and_an_existing_endpoint() {
    let (app_router, _) = build_test_app();
    let endpoint_id = create_endpoint(&app_router, endpoint_input("Orders app")).await;

    let (blank_status, blank_error) = call_api(
        &app_router,
        "POST",
        &format!("{ENDPOINTS_PATH}/{endpoint_id}/save-as-template"),
        Some(&json!({ "name": "  " })),
    )
    .await;
    let (missing_status, _) = call_api(
        &app_router,
        "POST",
        &format!("{ENDPOINTS_PATH}/01JB7T9Q2R5W8X3Y6Z1A4B7C9D/save-as-template"),
        Some(&json!({ "name": "Ops alert" })),
    )
    .await;

    assert_eq!(blank_status, 400);
    assert_eq!(blank_error["error"]["field"], "name");
    assert_eq!(missing_status, 404);
}

// AC: WH-09.6
#[tokio::test]
async fn an_endpoint_detached_by_deleting_its_template_still_sends_the_template() {
    let (app_router, operation_context) = build_test_app();
    let template_id = create_custom_template(&app_router, r#"{"version": "one"}"#).await;
    let endpoint_id = create_endpoint(
        &app_router,
        endpoint_with("Orders app", json!({ "template_id": template_id })),
    )
    .await;

    let (delete_status, _) = call_api(
        &app_router,
        "DELETE",
        &format!("{TEMPLATES_PATH}/{template_id}?endpoints=detach"),
        None,
    )
    .await;
    patch_endpoint(&app_router, &endpoint_id, json!({ "name": "Renamed app" })).await;
    let sent_request = queue_delivery(&operation_context, &endpoint_id).await;

    assert_eq!(delete_status, 204);
    assert_eq!(read_json_body(&sent_request.body)["version"], "one");
}
