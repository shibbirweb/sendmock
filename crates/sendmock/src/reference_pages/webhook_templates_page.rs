use std::fs;
use std::path::PathBuf;

use serde_json::Value;

use super::markdown_table::{code, render_markdown_table};
use super::render_page_header;

/// The catalogue's categories in the order the page lists them, with their headings.
const CATEGORY_HEADINGS: [(&str, &str); 6] = [
    ("generic", "SendMock"),
    ("email-provider", "Email providers"),
    ("sms-provider", "SMS providers"),
    ("payment-provider", "Payment providers"),
    ("chat", "Chat apps"),
    ("automation", "Automation"),
];

fn read_template_catalogue() -> Vec<Value> {
    let catalogue_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../sendmock-ops/builtin/webhook-template-catalogue.json");
    let catalogue_json = fs::read_to_string(catalogue_path).unwrap_or_default();
    serde_json::from_str::<Vec<Value>>(&catalogue_json).unwrap_or_default()
}

fn join_codes(value: &Value) -> String {
    value
        .as_array()
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(code)
                .collect::<Vec<String>>()
                .join(", ")
        })
        .unwrap_or_default()
}

pub fn render_webhook_templates_page() -> String {
    let template_catalogue = read_template_catalogue();
    assert!(
        !template_catalogue.is_empty(),
        "the built-in template catalogue is readable"
    );
    let mut page = render_page_header(
        "Built-in webhook templates",
        "Every webhook payload template SendMock ships, with the events it fits and the variables it needs.",
    );
    page.push_str(
        "Pick one on a webhook endpoint to send events in that service's format, signed as the \
         service signs them. Required variables (such as a signing secret) are set in \
         [Webhooks > Variables](../webhooks/variables.md). Copy a template to change it; see \
         [Templates](../webhooks/templates.md).\n\n",
    );
    for (category, heading) in CATEGORY_HEADINGS {
        let rows: Vec<Vec<String>> = template_catalogue
            .iter()
            .filter(|template| template["category"].as_str() == Some(category))
            .map(|template| {
                vec![
                    code(template["id"].as_str().unwrap_or_default()),
                    template["name"].as_str().unwrap_or_default().to_owned(),
                    join_codes(&template["events"]),
                    join_codes(&template["required_variables"]),
                ]
            })
            .collect();
        page.push_str(&format!("## {heading}\n\n"));
        page.push_str(&render_markdown_table(
            &["Template", "Name", "Events", "Required variables"],
            &rows,
        ));
        page.push('\n');
    }
    page.trim_end().to_owned() + "\n"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_catalogue_category_has_a_heading() {
        for template in read_template_catalogue() {
            let category = template["category"].as_str().unwrap_or_default();
            assert!(
                CATEGORY_HEADINGS
                    .iter()
                    .any(|(known_category, _)| *known_category == category),
                "no heading for {category}"
            );
        }
    }
}
