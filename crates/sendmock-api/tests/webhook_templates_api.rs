#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
    pub mod webhook_samples;
}

use sendmock_ops::sign_twilio_request;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};
use support::webhook_samples::{endpoint_input, send_email};

const TEMPLATES_PATH: &str = "/api/v1/webhooks/templates";

async fn send_sms(app_router: &axum::Router) -> String {
    let (status, sent_sms) = call_api(
        app_router,
        "POST",
        "/api/v1/sms",
        Some(
            &json!({ "from": "+15550001111", "to": "+14155550100", "body": "Your code is 482913" }),
        ),
    )
    .await;
    assert!(status == 200 || status == 201, "{status} {sent_sms}");
    sent_sms["id"].as_str().unwrap_or_default().to_owned()
}

async fn render_template(
    app_router: &axum::Router,
    template_id: &str,
    render_body: Value,
) -> Value {
    let (status, render_result) = call_api(
        app_router,
        "POST",
        &format!("{TEMPLATES_PATH}/{template_id}/render"),
        Some(&render_body),
    )
    .await;
    assert_eq!(status, 200, "{template_id}: {render_result}");
    render_result
}

async fn post_template(app_router: &axum::Router, path: &str, body: Value) -> Value {
    let (status, created_template) = call_api(app_router, "POST", path, Some(&body)).await;
    assert_eq!(status, 201, "{created_template}");
    created_template
}

fn draft_with_body(body_template: &str) -> Value {
    json!({
        "method": "POST", "content_type": "application/json",
        "header_templates": {}, "body_template": body_template,
    })
}

// AC: WH-08.1
#[tokio::test]
async fn every_builtin_template_renders_against_its_sample_and_a_real_message() {
    let (app_router, _) = build_test_app();
    let email_id = send_email(&app_router, "ann@example.com", "Welcome").await;
    let sms_id = send_sms(&app_router).await;
    let (_, listed_templates) = call_api(&app_router, "GET", TEMPLATES_PATH, None).await;
    let builtin_templates: Vec<Value> = listed_templates
        .as_array()
        .cloned()
        .unwrap_or_default()
        .into_iter()
        .filter(|listed_template| listed_template["source"] == "builtin")
        .collect();

    assert_eq!(builtin_templates.len(), 18);
    for builtin_template in builtin_templates {
        let template_id = builtin_template["id"].as_str().unwrap_or_default();
        let first_event = builtin_template["events"][0].as_str().unwrap_or_default();
        let real_message = if first_event.starts_with("sms.") {
            json!({ "sms_id": sms_id })
        } else {
            json!({ "email_id": email_id })
        };
        for render_body in [json!({}), real_message] {
            let render_result = render_template(&app_router, template_id, render_body).await;
            assert_eq!(
                render_result["errors"],
                json!([]),
                "{template_id}: {render_result}"
            );
        }
    }
}

// AC: WH-08.4
#[tokio::test]
async fn a_template_detail_shows_its_shape_and_previews_against_a_chosen_email() {
    let (app_router, _) = build_test_app();
    let email_id = send_email(&app_router, "ann@example.com", "Order shipped").await;

    let (_, template_detail) = call_api(
        &app_router,
        "GET",
        &format!("{TEMPLATES_PATH}/slack.incoming_webhook"),
        None,
    )
    .await;
    let email_render = render_template(
        &app_router,
        "slack.incoming_webhook",
        json!({ "email_id": email_id, "draft": draft_with_body("{\"text\": \"{{ data.subject }} {{ vars.missing }}\"}") }),
    )
    .await;

    assert_eq!(template_detail["service"], "Slack");
    assert_eq!(template_detail["method"], "POST");
    assert!(template_detail["doc_url"].is_string());
    assert!(template_detail["verified_on"].is_string());
    assert_eq!(template_detail["used_by_endpoint_count"], 0);
    assert_eq!(email_render["rendered_against"], "Order shipped");
    assert_eq!(email_render["body"], "{\"text\": \"Order shipped \"}");
    assert_eq!(
        email_render["warnings"],
        json!(["Undefined variable: vars.missing"])
    );
}

#[tokio::test]
async fn the_twilio_template_signs_its_form_fields() {
    let (app_router, _) = build_test_app();

    let render_result = render_template(&app_router, "twilio.inbound_sms", json!({})).await;

    let form_body = render_result["body"].as_str().unwrap_or_default();
    let form_pairs: Vec<(String, String)> =
        serde_urlencoded::from_str(form_body).unwrap_or_default();
    let form_fields: serde_json::Map<String, Value> = form_pairs
        .into_iter()
        .map(|(field_name, field_value)| (field_name, Value::from(field_value)))
        .collect();
    let expected_signature = sign_twilio_request(
        "http://localhost:8000/webhooks/preview",
        &Value::Object(form_fields),
        "",
    );
    assert_eq!(
        render_result["headers"]["X-Twilio-Signature"],
        expected_signature
    );
}

// AC: WH-09.1
// AC: WH-09.9
#[tokio::test]
async fn a_blank_template_and_a_clone_become_custom_templates() {
    let (app_router, _) = build_test_app();

    let blank_template = post_template(
        &app_router,
        TEMPLATES_PATH,
        json!({ "name": "Order webhook" }),
    )
    .await;
    let cloned_template = post_template(
        &app_router,
        &format!("{TEMPLATES_PATH}/slack.incoming_webhook/clone"),
        json!({ "name": "Slack alerts (team)" }),
    )
    .await;
    let second_blank = post_template(
        &app_router,
        TEMPLATES_PATH,
        json!({ "name": "Order webhook" }),
    )
    .await;
    let (_, cloned_detail) = call_api(
        &app_router,
        "GET",
        &format!(
            "{TEMPLATES_PATH}/{}",
            cloned_template["id"].as_str().unwrap_or_default()
        ),
        None,
    )
    .await;
    let (_, shipped_slack) = call_api(
        &app_router,
        "GET",
        &format!("{TEMPLATES_PATH}/slack.incoming_webhook"),
        None,
    )
    .await;

    assert_eq!(blank_template["id"], "custom.order_webhook");
    assert_eq!(blank_template["source"], "custom");
    assert_eq!(blank_template["revision"], 1);
    assert_eq!(second_blank["id"], "custom.order_webhook_2");
    assert_eq!(cloned_template["id"], "custom.slack_alerts_team");
    assert_eq!(cloned_template["service"], "Slack");
    assert_eq!(
        cloned_template["description"],
        "Copy of Slack: incoming webhook."
    );
    assert_eq!(
        cloned_detail["body_template"],
        shipped_slack["body_template"]
    );
}

async fn patch_template(
    app_router: &axum::Router,
    template_id: &str,
    update_body: Value,
) -> (u16, Value) {
    call_api(
        app_router,
        "PATCH",
        &format!("{TEMPLATES_PATH}/{template_id}"),
        Some(&update_body),
    )
    .await
}

// AC: WH-09.5
// AC: WH-09.7
// AC: WH-09.9
#[tokio::test]
async fn each_save_keeps_a_revision_and_a_template_that_does_not_render_is_refused() {
    let (app_router, _) = build_test_app();
    let custom_template = post_template(
        &app_router,
        TEMPLATES_PATH,
        json!({ "name": "Order webhook" }),
    )
    .await;
    let template_id = custom_template["id"].as_str().unwrap_or_default();
    let mut renamed_draft = draft_with_body("{\"subject\": \"{{ data.subject }}\"}");
    renamed_draft["name"] = json!("Orders");
    renamed_draft["events"] = json!(["email.received", "email.bounced"]);

    let (edit_status, edited_template) =
        patch_template(&app_router, template_id, renamed_draft).await;
    let (refused_status, refused_error) =
        patch_template(&app_router, template_id, draft_with_body("{{ shout() }}")).await;
    let (_, revisions) = call_api(
        &app_router,
        "GET",
        &format!("{TEMPLATES_PATH}/{template_id}/revisions"),
        None,
    )
    .await;
    let (_, restored_template) = call_api(
        &app_router,
        "POST",
        &format!("{TEMPLATES_PATH}/{template_id}/revisions/1/restore"),
        None,
    )
    .await;

    assert_eq!(edit_status, 200, "{edited_template}");
    assert_eq!(edited_template["name"], "Orders");
    assert_eq!(edited_template["revision"], 2);
    assert_eq!(refused_status, 422);
    assert_eq!(refused_error["error"]["code"], "template_invalid");
    assert_eq!(refused_error["error"]["message"], "Unknown function: shout");
    let revision_numbers: Vec<&Value> = revisions
        .as_array()
        .map(|kept| kept.iter().map(|revision| &revision["revision"]).collect())
        .unwrap_or_default();
    assert_eq!(revision_numbers, vec![&json!(2), &json!(1)]);
    assert_eq!(revisions[0]["template"]["name"], "Orders");
    assert_eq!(restored_template["revision"], 3);
    assert_eq!(restored_template["name"], "Order webhook");
}

// AC: WH-09.7
#[tokio::test]
async fn a_draft_with_the_wrong_shape_is_refused() {
    let (app_router, _) = build_test_app();
    let mut header_draft = draft_with_body("{}");
    header_draft["header_templates"] = json!({ "Bad Header": "x" });

    let (empty_body_status, empty_body_error) =
        patch_template(&app_router, "native", draft_with_body("  ")).await;
    let (header_status, header_error) = patch_template(&app_router, "native", header_draft).await;

    assert_eq!(empty_body_status, 422);
    assert_eq!(
        empty_body_error["error"]["message"],
        "Enter a body, or use GET for a request without one"
    );
    assert_eq!(header_status, 422);
    assert_eq!(
        header_error["error"]["message"],
        "\"Bad Header\" is not a valid header name"
    );
}

// AC: WH-09.8
// AC: WH-09.9
#[tokio::test]
async fn an_edited_builtin_is_modified_until_it_is_reset() {
    let (app_router, _) = build_test_app();
    let mut edited_draft = draft_with_body("{\"text\": \"{{ data.subject }}\"}");
    edited_draft["name"] = json!("Renamed");

    let (_, edited_template) =
        patch_template(&app_router, "slack.incoming_webhook", edited_draft).await;
    let (_, reset_template) = call_api(
        &app_router,
        "POST",
        &format!("{TEMPLATES_PATH}/slack.incoming_webhook/reset"),
        None,
    )
    .await;
    let (second_reset_status, _) = call_api(
        &app_router,
        "POST",
        &format!("{TEMPLATES_PATH}/slack.incoming_webhook/reset"),
        None,
    )
    .await;

    assert_eq!(edited_template["is_modified"], true);
    assert_eq!(edited_template["revision"], 2);
    assert_eq!(edited_template["name"], "Slack: incoming webhook");
    assert_eq!(
        edited_template["body_template"],
        "{\"text\": \"{{ data.subject }}\"}"
    );
    assert_eq!(reset_template["is_modified"], false);
    assert_eq!(reset_template["revision"], 1);
    assert_ne!(
        reset_template["body_template"],
        edited_template["body_template"]
    );
    assert_eq!(second_reset_status, 409);
}

// AC: WH-09.6
#[tokio::test]
async fn deleting_a_template_in_use_needs_detach() {
    let (app_router, _) = build_test_app();
    let custom_template = post_template(
        &app_router,
        TEMPLATES_PATH,
        json!({ "name": "Order webhook" }),
    )
    .await;
    let template_id = custom_template["id"].as_str().unwrap_or_default();
    let mut endpoint_body = endpoint_input("Orders app");
    endpoint_body["template_id"] = json!(template_id);
    let created_endpoint =
        post_template(&app_router, "/api/v1/webhooks/endpoints", endpoint_body).await;
    let template_path = format!("{TEMPLATES_PATH}/{template_id}");

    let (in_use_status, in_use_error) = call_api(&app_router, "DELETE", &template_path, None).await;
    let (builtin_status, builtin_error) = call_api(
        &app_router,
        "DELETE",
        &format!("{TEMPLATES_PATH}/native"),
        None,
    )
    .await;
    let (detach_status, _) = call_api(
        &app_router,
        "DELETE",
        &format!("{template_path}?endpoints=detach"),
        None,
    )
    .await;
    let (_, moved_endpoint) = call_api(
        &app_router,
        "GET",
        &format!(
            "/api/v1/webhooks/endpoints/{}",
            created_endpoint["id"].as_str().unwrap_or_default()
        ),
        None,
    )
    .await;
    let (gone_status, _) = call_api(&app_router, "GET", &template_path, None).await;

    assert_eq!(in_use_status, 409);
    assert_eq!(in_use_error["error"]["code"], "template_in_use");
    assert_eq!(builtin_status, 409);
    assert_eq!(builtin_error["error"]["code"], "read_only_template");
    assert_eq!(detach_status, 204);
    assert_eq!(moved_endpoint["template_id"], "native");
    assert_eq!(gone_status, 404);
}
