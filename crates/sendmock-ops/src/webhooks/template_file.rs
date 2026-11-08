//! The template file the Templates screen exports and imports, as the mock writes it: TOML (or
//! the same keys as JSON) with the request shape and the names of the variables the template
//! needs, never their values.

use std::collections::BTreeMap;

use serde::Deserialize;

use super::endpoint_settings::WebhookHttpMethod;
use super::template_view::{TemplateDraft, TemplateSource, WebhookTemplateDetail};

/// A template read from a file.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TemplateFile {
    pub template_id: Option<String>,
    pub name: String,
    pub service: String,
    pub events: Vec<String>,
    pub required_variables: Vec<String>,
    /// Written for a built-in template, so importing it edits that built-in.
    pub edits_builtin: bool,
    pub draft: TemplateDraft,
}

#[derive(Deserialize)]
struct TemplateFileFields {
    id: Option<String>,
    name: Option<String>,
    service: Option<String>,
    #[serde(default)]
    events: Vec<String>,
    #[serde(default)]
    variables: Vec<String>,
    #[serde(default)]
    edits_builtin: bool,
    request: Option<RequestFields>,
}

#[derive(Deserialize)]
struct RequestFields {
    method: Option<String>,
    content_type: Option<String>,
    body: Option<String>,
    #[serde(default)]
    headers: BTreeMap<String, String>,
}

const MISSING_FIELDS_MESSAGE: &str =
    "A template needs name, request.method, request.content_type and request.body";

fn quote_toml(text: &str) -> String {
    serde_json::to_string(text).unwrap_or_else(|_| "\"\"".to_owned())
}

/// A multi-line literal keeps the body exactly as written; a body it cannot hold (one with
/// `'''` or a control character) is written as a quoted string instead.
fn write_toml_body(body_template: &str) -> String {
    let fits_literal = !body_template.contains("'''")
        && !body_template
            .chars()
            .any(|character| character.is_control() && character != '\n' && character != '\t');
    if fits_literal {
        format!("'''\n{body_template}\n'''")
    } else {
        quote_toml(body_template)
    }
}

fn write_toml_list(items: &[String]) -> String {
    let quoted_items: Vec<String> = items.iter().map(|item| quote_toml(item)).collect();
    format!("[{}]", quoted_items.join(", "))
}

/// `<id>.sendmock-template.toml`, line for line as the mock exports it.
pub fn write_template_toml(template_detail: &WebhookTemplateDetail) -> String {
    let summary = &template_detail.summary;
    let draft = &template_detail.draft;
    let method = serde_json::to_value(draft.method)
        .ok()
        .and_then(|method| method.as_str().map(str::to_owned))
        .unwrap_or_else(|| "POST".to_owned());
    let mut lines = vec![
        "# SendMock webhook template, exported from Webhooks > Templates.".to_owned(),
        format!("id = {}", quote_toml(&summary.id)),
        format!("name = {}", quote_toml(&summary.name)),
        format!("service = {}", quote_toml(&summary.service)),
        format!("events = {}", write_toml_list(&summary.events)),
        format!(
            "variables = {}",
            write_toml_list(&summary.required_variables)
        ),
        format!(
            "edits_builtin = {}",
            summary.source == TemplateSource::Builtin
        ),
        String::new(),
        "[request]".to_owned(),
        format!("method = {}", quote_toml(&method)),
        format!("content_type = {}", quote_toml(&draft.content_type)),
        format!("body = {}", write_toml_body(&draft.body_template)),
        String::new(),
        "[request.headers]".to_owned(),
    ];
    lines.extend(
        draft
            .header_templates
            .iter()
            .map(|(header_name, header_template)| {
                format!(
                    "{} = {}",
                    quote_toml(header_name),
                    quote_toml(header_template)
                )
            }),
    );
    lines.push(String::new());
    lines.join("\n")
}

fn read_file_fields(file_text: &str) -> Result<(TemplateFileFields, bool), String> {
    let is_json = file_text.trim_start().starts_with('{');
    let file_fields = if is_json {
        serde_json::from_str(file_text).map_err(|parse_error| parse_error.to_string())
    } else {
        toml::from_str(file_text).map_err(|parse_error| parse_error.message().to_owned())
    };
    file_fields
        .map(|file_fields| (file_fields, is_json))
        .map_err(|reason| format!("The file could not be read: {reason}"))
}

fn read_method(method_text: &str) -> Result<WebhookHttpMethod, String> {
    serde_json::from_value(serde_json::Value::from(method_text))
        .map_err(|_| format!("request.method \"{method_text}\" is not an HTTP method"))
}

/// Reads an exported template file, TOML or JSON, or says why it cannot.
pub fn parse_template_file(file_text: &str) -> Result<TemplateFile, String> {
    let (file_fields, is_json) = read_file_fields(file_text)?;
    let Some(request) = file_fields.request else {
        return Err(MISSING_FIELDS_MESSAGE.to_owned());
    };
    let (Some(name), Some(method_text), Some(content_type), Some(body)) = (
        file_fields.name,
        request.method,
        request.content_type,
        request.body,
    ) else {
        return Err(MISSING_FIELDS_MESSAGE.to_owned());
    };
    // The TOML literal ends with the line break before its closing quotes.
    let body_template = match body.strip_suffix('\n') {
        Some(trimmed_body) if !is_json => trimmed_body.to_owned(),
        _ => body,
    };
    Ok(TemplateFile {
        template_id: file_fields.id,
        name,
        service: file_fields.service.unwrap_or_else(|| "Custom".to_owned()),
        events: file_fields.events,
        required_variables: file_fields.variables,
        edits_builtin: file_fields.edits_builtin,
        draft: TemplateDraft {
            method: read_method(&method_text)?,
            content_type,
            header_templates: request.headers,
            body_template,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::webhooks::template_view::{TemplateCategory, WebhookTemplateSummary};

    fn template_detail(body_template: &str) -> WebhookTemplateDetail {
        WebhookTemplateDetail {
            summary: WebhookTemplateSummary {
                id: "custom.order_webhook".to_owned(),
                name: "Order webhook".to_owned(),
                service: "Custom".to_owned(),
                category: TemplateCategory::Custom,
                source: TemplateSource::Custom,
                events: vec!["email.received".to_owned()],
                description: String::new(),
                required_variables: vec!["app_token".to_owned()],
                revision: 1,
                is_modified: false,
            },
            draft: TemplateDraft {
                method: WebhookHttpMethod::Post,
                content_type: "application/json".to_owned(),
                header_templates: BTreeMap::from([(
                    "Authorization".to_owned(),
                    "Bearer {{ vars.app_token }}".to_owned(),
                )]),
                body_template: body_template.to_owned(),
            },
            doc_url: None,
            verified_on: None,
            used_by_endpoint_count: 0,
        }
    }

    fn read_back(template_detail: &WebhookTemplateDetail) -> TemplateFile {
        parse_template_file(&write_template_toml(template_detail))
            .unwrap_or_else(|reason| panic!("the export reads back: {reason}"))
    }

    #[test]
    fn an_exported_template_reads_back_the_same() {
        let exported_template = template_detail("{\n  \"subject\": \"{{ data.subject }}\"\n}\n");

        let read_template = read_back(&exported_template);

        assert_eq!(read_template.draft, exported_template.draft);
        assert_eq!(
            read_template.template_id.as_deref(),
            Some("custom.order_webhook")
        );
        assert_eq!(read_template.required_variables, ["app_token"]);
        assert!(!read_template.edits_builtin);
    }

    #[test]
    fn a_body_with_triple_quotes_is_written_as_a_quoted_string() {
        let exported_template = template_detail("text '''quoted''' \u{1}");

        let read_template = read_back(&exported_template);

        assert_eq!(read_template.draft.body_template, "text '''quoted''' \u{1}");
    }

    #[test]
    fn the_export_has_the_mocks_layout() {
        let toml_text = write_template_toml(&template_detail("{}"));

        assert!(toml_text.starts_with(
            "# SendMock webhook template, exported from Webhooks > Templates.\nid = \"custom.order_webhook\"\n"
        ));
        assert!(toml_text.contains("variables = [\"app_token\"]\nedits_builtin = false\n"));
        assert!(toml_text.contains("body = '''\n{}\n'''\n"));
        assert!(
            toml_text.ends_with(
                "[request.headers]\n\"Authorization\" = \"Bearer {{ vars.app_token }}\"\n"
            )
        );
    }

    #[test]
    fn a_json_file_with_the_same_keys_is_read() {
        let read_template = parse_template_file(
            r#"{"name": "Ops", "request": {"method": "PUT", "content_type": "text/plain", "body": "hi\n"}}"#,
        );

        let read_template = read_template.unwrap_or_else(|reason| panic!("{reason}"));
        assert_eq!(read_template.draft.method, WebhookHttpMethod::Put);
        assert_eq!(read_template.draft.body_template, "hi\n");
        assert_eq!(read_template.service, "Custom");
    }

    #[test]
    fn a_file_without_the_request_shape_is_refused() {
        let missing_body = parse_template_file("name = \"Ops\"\n[request]\nmethod = \"POST\"\n");

        assert_eq!(missing_body, Err(MISSING_FIELDS_MESSAGE.to_owned()));
    }

    #[test]
    fn a_file_that_is_not_toml_says_it_could_not_be_read() {
        let unreadable_file = parse_template_file("name = ");

        assert!(
            unreadable_file
                .as_ref()
                .is_err_and(|reason| reason.starts_with("The file could not be read: ")),
            "{unreadable_file:?}"
        );
    }

    #[test]
    fn an_unknown_method_is_refused() {
        let unknown_method = parse_template_file(
            "name = \"Ops\"\n[request]\nmethod = \"FETCH\"\ncontent_type = \"a\"\nbody = \"\"\n",
        );

        assert_eq!(
            unknown_method,
            Err("request.method \"FETCH\" is not an HTTP method".to_owned())
        );
    }
}
