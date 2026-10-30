//! The body of an endpoint request in each body mode (WH-07.6, WH-07.14). Fields always
//! encode a valid JSON or form body: a value that does not fit its type is an error.

use std::collections::BTreeMap;

use sendmock_core::TemplateEscape;
use serde_json::{Map, Value};

use super::endpoint_settings::{
    BodyFieldType, EndpointBodyField, EndpointBodyMode, EndpointRequestSettings, FieldsEncoding,
};
use super::endpoint_template::EndpointTemplate;
use super::endpoint_template_body_rendering::render_template_body;
use super::request_part_renderer::{RenderProblem, RenderProblemSeverity, RequestPartRenderer};
use crate::{AppEvent, OperationError};

pub struct RenderedBody {
    /// None when the request has no body.
    pub content_type: Option<String>,
    pub body: String,
    /// A payload template's own headers, in lowercase; the endpoint's headers go over them.
    pub template_headers: BTreeMap<String, String>,
}

/// "user.email" = x becomes { "user": { "email": x } }.
fn set_nested_value(target_object: &mut Map<String, Value>, dotted_name: &str, field_value: Value) {
    let mut name_parts: Vec<&str> = dotted_name.split('.').collect();
    let last_part = name_parts.pop().unwrap_or(dotted_name);
    let mut current_object = target_object;
    for name_part in name_parts {
        let next_value = current_object
            .entry(name_part.to_owned())
            .or_insert_with(|| Value::Object(Map::new()));
        if !next_value.is_object() {
            *next_value = Value::Object(Map::new());
        }
        let Value::Object(next_object) = next_value else {
            return;
        };
        current_object = next_object;
    }
    current_object.insert(last_part.to_owned(), field_value);
}

/// A rendered field value as its type, or the problem that stops it.
fn to_typed_value(body_field: &EndpointBodyField, rendered_value: &str) -> Result<Value, String> {
    let field_name = &body_field.name;
    match body_field.value_type {
        BodyFieldType::Text => Ok(Value::from(rendered_value)),
        BodyFieldType::Number => serde_json::from_str::<serde_json::Number>(rendered_value.trim())
            .map(Value::Number)
            .map_err(|_| {
                format!("{field_name} renders \"{rendered_value}\", which is not a number")
            }),
        BodyFieldType::Boolean => match rendered_value.trim() {
            "true" => Ok(Value::Bool(true)),
            "false" => Ok(Value::Bool(false)),
            _ => Err(format!(
                "{field_name} renders \"{rendered_value}\"; use true or false"
            )),
        },
        BodyFieldType::Json => serde_json::from_str(rendered_value)
            .map_err(|_| format!("{field_name} does not render valid JSON")),
    }
}

fn render_fields_body(
    part_renderer: &mut RequestPartRenderer,
    request_settings: &EndpointRequestSettings,
) -> Result<RenderedBody, OperationError> {
    let rendered_fields: Vec<(&EndpointBodyField, String, String)> = request_settings
        .body_fields
        .iter()
        .enumerate()
        .map(|(field_index, body_field)| {
            let source = format!("field.{field_index}");
            let rendered_value =
                part_renderer.render_part(&body_field.value, &source, TemplateEscape::None);
            (body_field, rendered_value, source)
        })
        .collect();
    if request_settings.fields_encoding == FieldsEncoding::Form {
        let form_pairs: Vec<(&str, &str)> = rendered_fields
            .iter()
            .map(|(body_field, rendered_value, _)| {
                (body_field.name.as_str(), rendered_value.as_str())
            })
            .collect();
        return Ok(RenderedBody {
            content_type: Some("application/x-www-form-urlencoded".to_owned()),
            body: serde_urlencoded::to_string(form_pairs)
                .map_err(|encode_error| OperationError::Internal(encode_error.to_string()))?,
            template_headers: BTreeMap::new(),
        });
    }
    let mut json_body = Map::new();
    for (body_field, rendered_value, source) in rendered_fields {
        let typed_value = to_typed_value(body_field, &rendered_value).unwrap_or_else(|message| {
            part_renderer
                .problems
                .push(RenderProblem::error(message, &source));
            Value::from(rendered_value)
        });
        set_nested_value(&mut json_body, &body_field.name, typed_value);
    }
    Ok(RenderedBody {
        content_type: Some("application/json".to_owned()),
        body: serde_json::to_string(&Value::Object(json_body))
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?,
        template_headers: BTreeMap::new(),
    })
}

/// A raw body: values inside a JSON body are escaped so quotes in a message keep it valid.
fn render_raw_body(
    part_renderer: &mut RequestPartRenderer,
    request_settings: &EndpointRequestSettings,
) -> RenderedBody {
    let is_json_body = request_settings.raw_content_type.contains("json");
    let escape = if is_json_body {
        TemplateEscape::JsonString
    } else {
        TemplateEscape::None
    };
    let had_errors = part_renderer.has_errors();
    let rendered_body = part_renderer.render_part(&request_settings.raw_body, "body", escape);
    let is_invalid_json = is_json_body
        && !rendered_body.trim().is_empty()
        && serde_json::from_str::<Value>(&rendered_body).is_err();
    if is_invalid_json && !had_errors && !part_renderer.has_errors() {
        part_renderer.problems.push(RenderProblem {
            severity: RenderProblemSeverity::Warning,
            ..RenderProblem::error("The rendered body is not valid JSON".to_owned(), "body")
        });
    }
    RenderedBody {
        content_type: Some(request_settings.raw_content_type.clone()),
        body: rendered_body,
        template_headers: BTreeMap::new(),
    }
}

/// The body in the endpoint's mode; Template mode needs the endpoint's template.
pub fn render_endpoint_body(
    part_renderer: &mut RequestPartRenderer,
    request_settings: &EndpointRequestSettings,
    endpoint_template: Option<&EndpointTemplate>,
    app_event: &AppEvent,
) -> Result<RenderedBody, OperationError> {
    match request_settings.body_mode {
        EndpointBodyMode::None => Ok(RenderedBody {
            content_type: None,
            body: String::new(),
            template_headers: BTreeMap::new(),
        }),
        EndpointBodyMode::Fields => render_fields_body(part_renderer, request_settings),
        EndpointBodyMode::Raw => Ok(render_raw_body(part_renderer, request_settings)),
        EndpointBodyMode::Template => {
            let endpoint_template = endpoint_template.ok_or_else(|| {
                OperationError::Internal("Template mode was rendered without a template".to_owned())
            })?;
            render_template_body(
                part_renderer,
                endpoint_template,
                &request_settings.extra_fields,
                app_event,
            )
        }
    }
}
