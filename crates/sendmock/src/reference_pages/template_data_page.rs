//! Every field a webhook template reads as `data`, listed from real events: an email sent with
//! headers, a copy and an attachment, then bounced, and an inbound SMS, each run through the
//! same code a delivery uses (AI-08.1).

use std::sync::Arc;

use sendmock_core::{FixedClock, SeededRandomSource, SequentialIdGenerator};
use sendmock_ops::{
    InstanceDetails, OperationAnswer, OperationContext, OperationRegistry, ReleaseChannel,
    build_operation_registry, read_event_template_data,
};
use sendmock_store::{Database, DatabaseLocation, EMBEDDED_MIGRATIONS};
use serde_json::{Value, json};

use super::markdown_table::{code, render_markdown_table};
use super::render_page_header;

const SAMPLE_TIME_UNIX_MS: i64 = 1_767_225_600_000;

fn build_sample_context() -> OperationContext {
    let database = Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)
        .unwrap_or_else(|error| panic!("an in-memory database: {error}"));
    OperationContext::new(
        Arc::new(database),
        Arc::new(FixedClock::new(SAMPLE_TIME_UNIX_MS)),
        Arc::new(SequentialIdGenerator::new(1_767_225_600_000)),
        InstanceDetails {
            version: "0.0.0",
            channel: ReleaseChannel::Dev,
            started_at_unix_ms: SAMPLE_TIME_UNIX_MS,
            http_address: "127.0.0.1:8025".to_owned(),
            smtp_address: "127.0.0.1:1025".to_owned(),
            provider_address: Some("127.0.0.1:8026".to_owned()),
            catcher_address: None,
            pop3_address: None,
            provider_tls: None,
            is_container: false,
        },
    )
    .with_random_source(Arc::new(SeededRandomSource::new(7)))
}

async fn run_operation(
    registry: &OperationRegistry,
    context: &OperationContext,
    operation_id: &str,
    input: Value,
) -> Value {
    let operation = registry
        .find_by_operation_id(operation_id)
        .unwrap_or_else(|| panic!("the {operation_id} operation"));
    match operation.execute_answer(context, input).await {
        Ok(OperationAnswer::Json(answer)) => answer,
        Ok(_) => Value::Null,
        Err(error) => panic!("{operation_id}: {error}"),
    }
}

/// The template data of a bounced email and of an inbound SMS.
async fn build_sample_data() -> (Value, Value) {
    let (context, registry) = (build_sample_context(), build_operation_registry());
    let sent_email = run_operation(&registry, &context, "postSend", json!({
        "from": "Shop <shop@example.test>", "to": ["Sam <sam@example.test>"],
        "cc": ["ana@example.test"], "subject": "Your order", "text": "Shipped\n-- \nShop",
        "html": "<p>Shipped</p>", "headers": { "X-Order-Id": "A-1001" }, "tags": ["orders"],
        "attachments": [{ "filename": "invoice.pdf", "content": "JVBERi0=", "content_type": "application/pdf" }],
    })).await;
    let email_id = sent_email["id"].clone();
    run_operation(
        &registry,
        &context,
        "postEmailsByEmailIdSimulate",
        json!({
            "email_id": email_id, "event": "bounced", "bounce_type": "hard",
        }),
    )
    .await;
    let email_data =
        read_event_template_data(&context, "email.bounced", &json!({ "id": email_id }))
            .await
            .unwrap_or_else(|error| panic!("{error}"));
    run_operation(
        &registry,
        &context,
        "postSmsInbound",
        json!({
            "from": "+447700900123", "to": "+15550001111", "body": "Your code is 482913",
        }),
    )
    .await;
    let sms_page = run_operation(&registry, &context, "getSms", json!({})).await;
    let sms_data = read_event_template_data(&context, "sms.inbound", &sms_page["items"][0])
        .await
        .unwrap_or_else(|error| panic!("{error}"));
    (email_data.data, sms_data.data)
}

fn name_value_type(value: &Value) -> &'static str {
    match value {
        Value::Null => "null in this sample",
        Value::Bool(_) => "true or false",
        Value::Number(_) => "number",
        Value::String(_) => "text",
        Value::Array(_) => "list",
        Value::Object(_) => "object",
    }
}

/// Each field's path and type; a list's items are listed under `path[]` from its first item.
fn collect_field_rows(path: &str, value: &Value, rows: &mut Vec<Vec<String>>) {
    rows.push(vec![code(path), name_value_type(value).to_owned()]);
    match value {
        Value::Object(fields) => {
            for (field_name, field_value) in fields {
                collect_field_rows(&format!("{path}.{field_name}"), field_value, rows);
            }
        }
        Value::Array(items) => {
            if let Some(first_item) = items.first() {
                collect_field_rows(&format!("{path}[]"), first_item, rows);
            }
        }
        _ => {}
    }
}

fn render_field_table(data: &Value) -> String {
    let mut rows = Vec::new();
    collect_field_rows("data", data, &mut rows);
    render_markdown_table(&["Field", "Type"], &rows)
}

pub async fn render_template_data_page() -> String {
    let (email_data, sms_data) = build_sample_data().await;
    let mut page = render_page_header(
        "Template data",
        "Every field a webhook template reads as data for email and SMS events, listed from real events.",
    );
    page.push_str(
        "Besides `data`, a template reads `event` (`id`, `type`, `created_at`), `vars`, \
         `endpoint`, `delivery`, `rule`, `sendmock` and `request_id`; see \
         [Templates](../advanced/templates.md). This list comes from real events run through \
         the code a delivery uses: an email with a copy, a header, a tag and an attachment that \
         then bounced, and an SMS your app received. A field that is null here holds a value \
         when the message has one.\n\n",
    );
    page.push_str(
        "## Email events\n\n`email.*` events read the stored email in full, also as `email`.\n\n",
    );
    page.push_str(&render_field_table(&email_data));
    page.push_str(
        "\n## SMS events\n\n`sms.*` events read the message, with each number's country.\n\n",
    );
    page.push_str(&render_field_table(&sms_data));
    page
}
