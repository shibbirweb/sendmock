#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use sendmock_ops::load_template_directory;
use serde_json::{Value, json};
use support::test_app::{build_test_app, call_api};

const TEMPLATES_PATH: &str = "/api/v1/webhooks/templates";

const SHOP_TEMPLATE_TOML: &str = r#"id = "file.shop_orders"
name = "Shop orders from a file"
service = "Shop"
events = ["email.received"]

[request]
method = "POST"
content_type = "application/json"
body = '{"subject": "{{ data.subject }}"}'
"#;

// AC: WH-09.4
#[tokio::test]
async fn templates_from_the_directory_are_listed_rendered_and_read_only() -> std::io::Result<()> {
    let (app_router, operation_context) = build_test_app();
    let templates_directory = tempfile::tempdir()?;
    std::fs::write(
        templates_directory.path().join("shop-orders.toml"),
        SHOP_TEMPLATE_TOML,
    )?;
    let loaded = load_template_directory(templates_directory.path());
    operation_context
        .file_templates
        .replace_templates(loaded.templates);

    let (_, listed_templates) = call_api(&app_router, "GET", TEMPLATES_PATH, None).await;
    let (show_status, shown_template) = call_api(
        &app_router,
        "GET",
        &format!("{TEMPLATES_PATH}/file.shop_orders"),
        None,
    )
    .await;
    let (edit_status, refused_edit) = call_api(
        &app_router,
        "PATCH",
        &format!("{TEMPLATES_PATH}/file.shop_orders"),
        Some(&json!({
            "method": "POST", "content_type": "application/json",
            "header_templates": {}, "body_template": "{}",
        })),
    )
    .await;
    let (delete_status, _) = call_api(
        &app_router,
        "DELETE",
        &format!("{TEMPLATES_PATH}/file.shop_orders"),
        None,
    )
    .await;

    let file_template = listed_templates
        .as_array()
        .and_then(|templates| {
            templates
                .iter()
                .find(|listed_template| listed_template["id"] == "file.shop_orders")
        })
        .cloned()
        .unwrap_or(Value::Null);
    assert_eq!(file_template["source"], "file", "{listed_templates}");
    assert_eq!(file_template["name"], "Shop orders from a file");
    assert_eq!(show_status, 200, "{shown_template}");
    assert_eq!(edit_status, 409, "{refused_edit}");
    assert_eq!(delete_status, 409);
    Ok(())
}

// AC: WH-09.4
#[tokio::test]
async fn replacing_the_files_replaces_the_templates() -> std::io::Result<()> {
    let (app_router, operation_context) = build_test_app();
    let templates_directory = tempfile::tempdir()?;
    let template_path = templates_directory.path().join("shop-orders.toml");
    std::fs::write(&template_path, SHOP_TEMPLATE_TOML)?;
    operation_context
        .file_templates
        .replace_templates(load_template_directory(templates_directory.path()).templates);
    std::fs::write(
        &template_path,
        SHOP_TEMPLATE_TOML.replace("Shop orders from a file", "Renamed in the file"),
    )?;

    operation_context
        .file_templates
        .replace_templates(load_template_directory(templates_directory.path()).templates);

    let (_, shown_template) = call_api(
        &app_router,
        "GET",
        &format!("{TEMPLATES_PATH}/file.shop_orders"),
        None,
    )
    .await;
    assert_eq!(shown_template["name"], "Renamed in the file");
    Ok(())
}
