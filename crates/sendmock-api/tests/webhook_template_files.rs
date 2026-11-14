#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api, call_api_text};

const TEMPLATES_PATH: &str = "/api/v1/webhooks/templates";
const IMPORT_PATH: &str = "/api/v1/webhooks/templates/import";

/// A custom template that signs with a variable, answering its id.
async fn create_signed_template(app_router: &axum::Router) -> String {
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
    let (edit_status, edited_template) = call_api(
        app_router,
        "PATCH",
        &format!("{TEMPLATES_PATH}/{template_id}"),
        Some(&json!({
            "method": "PUT", "content_type": "application/json",
            "header_templates": { "Authorization": "Bearer {{ vars.app_token }}" },
            "body_template": "{\n  \"subject\": \"{{ data.subject }}\",\n  \"note\": \"it's '''quoted'''\"\n}",
            "events": ["email.received", "sms.inbound"],
            "required_variables": ["app_token"],
        })),
    )
    .await;
    assert_eq!(edit_status, 200, "{edited_template}");
    template_id
}

async fn create_secret_variable(app_router: &axum::Router) {
    let (status, created_variable) = call_api(
        app_router,
        "POST",
        "/api/v1/webhooks/variables",
        Some(&json!({
            "name": "app_token", "kind": "secret", "scope": "global", "endpoint_id": null,
            "value": "sk_live_secret_1234", "random_mode": null, "description": "Signs requests.",
        })),
    )
    .await;
    assert_eq!(status, 201, "{created_variable}");
}

async fn export_template(app_router: &axum::Router, template_id: &str) -> String {
    let (status, content_type, file_text) = call_api_text(
        app_router,
        &format!("{TEMPLATES_PATH}/{template_id}/export"),
    )
    .await;
    assert_eq!(status, 200, "{file_text}");
    assert!(
        content_type.starts_with("application/toml"),
        "{content_type}"
    );
    file_text
}

async fn import_template(app_router: &axum::Router, import_body: Value) -> (u16, Value) {
    call_api(app_router, "POST", IMPORT_PATH, Some(&import_body)).await
}

async fn get_template(app_router: &axum::Router, template_id: &str) -> Value {
    let (status, template_detail) = call_api(
        app_router,
        "GET",
        &format!("{TEMPLATES_PATH}/{template_id}"),
        None,
    )
    .await;
    assert_eq!(status, 200, "{template_detail}");
    template_detail
}

/// The parts of a template a file carries.
fn file_fields(template_detail: &Value) -> Value {
    json!({
        "name": template_detail["name"], "service": template_detail["service"],
        "events": template_detail["events"],
        "required_variables": template_detail["required_variables"],
        "method": template_detail["method"], "content_type": template_detail["content_type"],
        "header_templates": template_detail["header_templates"],
        "body_template": template_detail["body_template"],
    })
}

// AC: WH-09.3
#[tokio::test]
async fn an_exported_template_imports_as_the_same_template() {
    let (app_router, _) = build_test_app();
    let template_id = create_signed_template(&app_router).await;
    let exported_detail = get_template(&app_router, &template_id).await;
    let file_text = export_template(&app_router, &template_id).await;
    let (delete_status, _) = call_api(
        &app_router,
        "DELETE",
        &format!("{TEMPLATES_PATH}/{template_id}"),
        None,
    )
    .await;

    let (import_status, imported_summary) =
        import_template(&app_router, json!({ "file_text": file_text })).await;
    let imported_detail = get_template(
        &app_router,
        imported_summary["id"].as_str().unwrap_or_default(),
    )
    .await;

    assert_eq!(delete_status, 204);
    assert_eq!(import_status, 201, "{imported_summary}");
    assert_eq!(imported_summary["id"], template_id);
    assert_eq!(file_fields(&imported_detail), file_fields(&exported_detail));
}

// AC: WH-09.3
#[tokio::test]
async fn an_export_names_the_variables_but_never_their_values() {
    let (app_router, _) = build_test_app();
    create_secret_variable(&app_router).await;
    let template_id = create_signed_template(&app_router).await;

    let file_text = export_template(&app_router, &template_id).await;

    assert!(
        file_text.contains("variables = [\"app_token\"]"),
        "{file_text}"
    );
    assert!(file_text.contains("{{ vars.app_token }}"), "{file_text}");
    assert!(!file_text.contains("sk_live_secret_1234"), "{file_text}");
}

// AC: WH-09.3
#[tokio::test]
async fn importing_a_taken_id_needs_replace_or_copy() {
    let (app_router, _) = build_test_app();
    let template_id = create_signed_template(&app_router).await;
    let file_text = export_template(&app_router, &template_id).await;

    let (taken_status, taken_error) =
        import_template(&app_router, json!({ "file_text": file_text })).await;
    let (copy_status, copied_summary) = import_template(
        &app_router,
        json!({ "file_text": file_text, "on_conflict": "copy" }),
    )
    .await;
    let (replace_status, replaced_summary) = import_template(
        &app_router,
        json!({ "file_text": file_text, "on_conflict": "replace" }),
    )
    .await;

    assert_eq!(taken_status, 409);
    assert_eq!(taken_error["error"]["code"], "template_exists");
    assert_eq!(copy_status, 201, "{copied_summary}");
    assert_eq!(copied_summary["id"], format!("{template_id}_2"));
    assert_eq!(replace_status, 201, "{replaced_summary}");
    assert_eq!(replaced_summary["id"], template_id);
    assert_eq!(replaced_summary["revision"], 3);
}

// AC: WH-09.3
#[tokio::test]
async fn an_exported_builtin_imports_as_an_edit_of_that_builtin() {
    let (app_router, _) = build_test_app();
    let file_text = export_template(&app_router, "slack.incoming_webhook").await;
    let edited_file_text = file_text.replace("New {{ event.type }}", "Fresh {{ event.type }}");

    let (import_status, imported_summary) =
        import_template(&app_router, json!({ "file_text": edited_file_text })).await;
    let imported_detail = get_template(&app_router, "slack.incoming_webhook").await;

    assert!(file_text.contains("edits_builtin = true"), "{file_text}");
    assert_eq!(import_status, 201, "{imported_summary}");
    assert_eq!(imported_summary["id"], "slack.incoming_webhook");
    assert_eq!(imported_summary["is_modified"], true);
    assert!(
        imported_detail["body_template"]
            .as_str()
            .unwrap_or_default()
            .contains("Fresh {{ event.type }}")
    );
}

// AC: WH-09.3
#[tokio::test]
async fn a_file_that_cannot_be_read_or_rendered_is_refused() {
    let (app_router, _) = build_test_app();

    let (unreadable_status, unreadable_error) =
        import_template(&app_router, json!({ "file_text": "name = " })).await;
    let (broken_status, broken_error) = import_template(
        &app_router,
        json!({
            "file_text": "name = \"Broken\"\n[request]\nmethod = \"POST\"\ncontent_type = \"application/json\"\nbody = \"{{ data.subject | no_such_filter }}\"\n",
        }),
    )
    .await;

    assert_eq!(unreadable_status, 422);
    assert_eq!(unreadable_error["error"]["code"], "template_invalid");
    assert_eq!(broken_status, 422, "{broken_error}");
    assert_eq!(broken_error["error"]["code"], "template_invalid");
}

fn find_field<'fields>(fields: &'fields Value, field_path: &str) -> &'fields Value {
    fields
        .as_array()
        .and_then(|field_list| field_list.iter().find(|field| field["path"] == field_path))
        .unwrap_or_else(|| panic!("{field_path} is listed in {fields}"))
}

async fn get_reference(app_router: &axum::Router, events: &str) -> Value {
    let (status, reference) = call_api(
        app_router,
        "GET",
        &format!("/api/v1/webhooks/template-reference?events={events}"),
        None,
    )
    .await;
    assert_eq!(status, 200, "{reference}");
    reference
}

// AC: WH-07.9
#[tokio::test]
async fn the_reference_lists_the_context_of_the_chosen_events() {
    let (app_router, _) = build_test_app();

    let reference = get_reference(&app_router, "email.received,sms.inbound").await;
    let fields = &reference["fields"];
    let field_paths: Vec<&str> = fields
        .as_array()
        .map(|field_list| {
            field_list
                .iter()
                .filter_map(|field| field["path"].as_str())
                .collect()
        })
        .unwrap_or_default();
    let event_type = find_field(&find_field(fields, "event")["children"], "event.type");
    let data_children = &find_field(fields, "data")["children"];
    let first_recipient = &find_field(
        &find_field(data_children, "data.to")["children"],
        "data.to[0]",
    );

    assert_eq!(
        field_paths,
        [
            "event",
            "data",
            "vars",
            "endpoint",
            "delivery",
            "rule",
            "sendmock",
            "request_id"
        ]
    );
    assert_eq!(event_type["example"], "email.received");
    assert_eq!(
        find_field(data_children, "data.from_number")["example"],
        "+15550001111"
    );
    assert_ne!(
        find_field(&first_recipient["children"], "data.to[0].address")["description"],
        ""
    );
}

// AC: WH-07.9
#[tokio::test]
async fn the_reference_lists_global_variables_with_secrets_masked() {
    let (app_router, _) = build_test_app();
    create_secret_variable(&app_router).await;

    let reference = get_reference(&app_router, "email.received").await;
    let token_variable = find_field(
        &find_field(&reference["fields"], "vars")["children"],
        "vars.app_token",
    );

    assert_eq!(
        token_variable["description"],
        "secret variable. Signs requests."
    );
    assert_ne!(token_variable["example"], "sk_live_secret_1234");
}

// AC: WH-07.9
#[tokio::test]
async fn the_reference_lists_functions_and_filters_with_how_to_call_them() {
    let (app_router, _) = build_test_app();

    let reference = get_reference(&app_router, "sms.inbound").await;
    let twilio_signature = find_field_by_name(&reference["functions"], "twilio_signature");

    assert_eq!(
        twilio_signature["signature"],
        "twilio_signature(url, fields, auth_token)"
    );
    assert!(
        reference["filters"]
            .as_array()
            .is_some_and(|filters| !filters.is_empty())
    );
}

fn find_field_by_name<'helpers>(helpers: &'helpers Value, helper_name: &str) -> &'helpers Value {
    helpers
        .as_array()
        .and_then(|helper_list| {
            helper_list
                .iter()
                .find(|helper| helper["name"] == helper_name)
        })
        .unwrap_or_else(|| panic!("{helper_name} is listed in {helpers}"))
}
