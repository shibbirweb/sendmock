//! The checks the variable sheet makes (`web/src/lib/webhooks/validate-webhook-variable.ts`),
//! plus the API's own: the endpoint exists and an expression renders.

use sendmock_core::{StandardTemplateFunctions, TemplateRenderMode};
use sendmock_store::WebhookVariableRecord;
use serde_json::Value;

use super::template_context::build_sample_template_context;
use super::variable_inputs::{VariableKind, VariableScope, WebhookVariableInput};
use super::variable_resolution::{VariableDefinition, resolve_variable_value};
use crate::{OperationContext, OperationError};

/// Lowercase letters, digits and underscores, starting with a letter.
fn is_valid_variable_name(variable_name: &str) -> bool {
    let mut characters = variable_name.chars();
    characters
        .next()
        .is_some_and(|first_character| first_character.is_ascii_lowercase())
        && characters.all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '_'
        })
}

fn field_error(field_name: &str, message: &str) -> OperationError {
    OperationError::InvalidInput {
        message: message.to_owned(),
        field: Some(field_name.to_owned()),
    }
}

/// The problem with a value for its kind, as the sheet words it.
pub fn find_value_problem(kind: VariableKind, value_text: &str) -> Option<&'static str> {
    let is_blank = value_text.trim().is_empty();
    match kind {
        VariableKind::Text if is_blank => Some("Enter a value"),
        VariableKind::Number if is_blank || value_text.trim().parse::<f64>().is_err() => {
            Some("Enter a number")
        }
        VariableKind::Boolean if value_text != "true" && value_text != "false" => {
            Some("Use true or false")
        }
        VariableKind::Json if serde_json::from_str::<Value>(value_text).is_err() => {
            Some("Enter valid JSON")
        }
        VariableKind::Secret if is_blank => Some("Enter the secret"),
        VariableKind::Dynamic if is_blank => Some("Enter a path or expression, e.g. data.subject"),
        VariableKind::Random if is_blank => Some("Enter a generator, e.g. random_string(16)"),
        VariableKind::Computed if is_blank => Some("Enter a template, e.g. {{ vars.tenant_id }}"),
        _ => None,
    }
}

/// The endpoint a variable belongs to: none for a global one, an existing endpoint otherwise.
async fn read_variable_endpoint(
    operation_context: &OperationContext,
    variable_input: &WebhookVariableInput,
) -> Result<Option<String>, OperationError> {
    if variable_input.scope == VariableScope::Global {
        return Ok(None);
    }
    let endpoint_id = variable_input
        .endpoint_id
        .as_deref()
        .unwrap_or_default()
        .trim();
    let stored_endpoint = if endpoint_id.is_empty() {
        None
    } else {
        operation_context
            .webhook_endpoint_repository
            .find_endpoint(endpoint_id)
            .await?
    };
    match stored_endpoint {
        Some(_) => Ok(Some(endpoint_id.to_owned())),
        None => Err(field_error("endpoint_id", "Pick an endpoint")),
    }
}

/// An expression or template that does not render (an unknown function, a syntax error).
async fn check_expression_renders(
    operation_context: &OperationContext,
    variable_input: &WebhookVariableInput,
) -> Result<(), OperationError> {
    if !matches!(
        variable_input.kind,
        VariableKind::Dynamic | VariableKind::Random | VariableKind::Computed
    ) {
        return Ok(());
    }
    let sample_context = Value::Object(build_sample_template_context(operation_context).await?);
    let template_functions = StandardTemplateFunctions::new(
        operation_context.clock.clone(),
        operation_context.random_source.clone(),
    );
    let variable_definition = VariableDefinition {
        kind: variable_input.kind,
        value: &variable_input.value,
        random_mode: None,
        fixed_value: None,
    };
    resolve_variable_value(
        &variable_definition,
        &sample_context,
        &template_functions,
        TemplateRenderMode::Lenient,
    )
    .map(|_| ())
    .map_err(|render_problem| field_error("value", &render_problem.message))
}

/// Checks a new or changed variable and answers the endpoint it belongs to. `edited_variable`
/// is the stored one on an edit, where an empty secret keeps the stored value.
pub async fn validate_variable(
    operation_context: &OperationContext,
    variable_input: &WebhookVariableInput,
    edited_variable: Option<&WebhookVariableRecord>,
) -> Result<Option<String>, OperationError> {
    let is_valid_name = is_valid_variable_name(&variable_input.name);
    if !is_valid_name {
        return Err(field_error(
            "name",
            "Use lowercase letters, digits and underscores, starting with a letter",
        ));
    }
    let endpoint_id = read_variable_endpoint(operation_context, variable_input).await?;
    let edited_variable_id =
        edited_variable.map(|stored_variable| stored_variable.variable_id.as_str());
    let has_same_name = operation_context
        .webhook_variable_repository
        .list_variables(None)
        .await?
        .iter()
        .any(|stored_variable| {
            stored_variable.name == variable_input.name
                && stored_variable.endpoint_id == endpoint_id
                && Some(stored_variable.variable_id.as_str()) != edited_variable_id
        });
    if has_same_name {
        return Err(field_error(
            "name",
            "A variable with this name already exists here",
        ));
    }
    let is_keeping_stored_secret = edited_variable.is_some()
        && variable_input.kind == VariableKind::Secret
        && variable_input.value.is_empty();
    if let Some(value_problem) = find_value_problem(variable_input.kind, &variable_input.value)
        .filter(|_| !is_keeping_stored_secret)
    {
        return Err(field_error("value", value_problem));
    }
    if variable_input.kind == VariableKind::Random && variable_input.random_mode.is_none() {
        return Err(field_error("random_mode", "Pick Per send or Fixed"));
    }
    check_expression_renders(operation_context, variable_input).await?;
    Ok(endpoint_id)
}
