//! The request a payload template renders: the body first, then the headers, which can read
//! the form body's fields as `body_fields` (Twilio signs them, WH-06).

use std::collections::BTreeMap;

use sendmock_core::{TemplateEscape, TemplateFunctions, TemplateRenderMode};
use serde_json::{Map, Value};

use super::request_part_renderer::{RenderProblem, RequestPartRenderer};
use super::template_view::TemplateDraft;

pub struct RenderedTemplateRequest {
    /// `content-type` first, then the template's headers as written.
    pub headers: BTreeMap<String, String>,
    pub body: String,
}

/// The fields of a form body, a repeated name as a list of its values in order.
fn read_form_fields(form_body: &str) -> Value {
    let form_pairs: Vec<(String, String)> =
        serde_urlencoded::from_str(form_body).unwrap_or_default();
    let mut form_fields = Map::new();
    for (field_name, field_value) in form_pairs {
        match form_fields.get_mut(&field_name) {
            Some(Value::Array(repeated_values)) => repeated_values.push(Value::from(field_value)),
            Some(single_value) => {
                *single_value = Value::Array(vec![single_value.take(), Value::from(field_value)]);
            }
            None => {
                form_fields.insert(field_name, Value::from(field_value));
            }
        }
    }
    Value::Object(form_fields)
}

fn with_body_fields(template_context: &Value, body_fields: Value) -> Value {
    let mut context_fields = match template_context {
        Value::Object(context_fields) => context_fields.clone(),
        _ => Map::new(),
    };
    context_fields.insert("body_fields".to_owned(), body_fields);
    Value::Object(context_fields)
}

/// Renders a template's body and headers; the problems are tagged `body` and `header.<n>`.
pub fn render_template_request(
    template_draft: &TemplateDraft,
    template_context: &Value,
    template_functions: &dyn TemplateFunctions,
    render_mode: TemplateRenderMode,
) -> (RenderedTemplateRequest, Vec<RenderProblem>) {
    let content_type = &template_draft.content_type;
    let body_escape = if content_type.contains("json") {
        TemplateEscape::JsonString
    } else {
        TemplateEscape::None
    };
    let mut body_renderer = RequestPartRenderer {
        template_context,
        template_functions,
        render_mode,
        problems: Vec::new(),
    };
    let body = body_renderer.render_part(&template_draft.body_template, "body", body_escape);
    let body_fields = if content_type.contains("x-www-form-urlencoded") {
        read_form_fields(&body)
    } else {
        Value::Object(Map::new())
    };
    let header_context = with_body_fields(template_context, body_fields);
    let mut header_renderer = RequestPartRenderer {
        template_context: &header_context,
        template_functions,
        render_mode,
        problems: body_renderer.problems,
    };
    let mut headers = BTreeMap::from([("content-type".to_owned(), content_type.clone())]);
    for (header_index, (header_name, header_template)) in
        template_draft.header_templates.iter().enumerate()
    {
        let rendered_value = header_renderer.render_part(
            header_template,
            &format!("header.{header_index}"),
            TemplateEscape::None,
        );
        headers.insert(header_name.clone(), rendered_value);
    }
    (
        RenderedTemplateRequest { headers, body },
        header_renderer.problems,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_repeated_form_field_becomes_a_list() {
        let form_fields = read_form_fields("To=%2B1555&MediaUrl=a&MediaUrl=b");

        assert_eq!(
            form_fields,
            serde_json::json!({ "To": "+1555", "MediaUrl": ["a", "b"] })
        );
    }
}
