//! What each variable is worth for one render: send-time values win over endpoint variables,
//! which win over global ones ([12](docs/plan/12-webhook-variables.md#scopes-and-precedence)).
//! Fixed values resolve first, then Dynamic and Random expressions, then Computed templates,
//! which can read every value before them as `vars.<name>`.

use std::collections::BTreeMap;

use sendmock_core::{
    TemplateEscape, TemplateFunctions, TemplateProblem, TemplateRenderMode,
    evaluate_template_expression, render_template_in_mode,
};
use sendmock_store::WebhookVariableRecord;
use serde_json::{Map, Value};

use super::variable_inputs::{RandomMode, VariableKind};

/// One variable's definition, as stored or as a preview tries it.
pub struct VariableDefinition<'definition> {
    pub kind: VariableKind,
    pub value: &'definition str,
    pub random_mode: Option<RandomMode>,
    pub fixed_value: Option<&'definition str>,
}

impl<'definition> VariableDefinition<'definition> {
    pub fn from_record(stored_variable: &'definition WebhookVariableRecord) -> Option<Self> {
        Some(Self {
            kind: VariableKind::parse(&stored_variable.kind)?,
            value: &stored_variable.value,
            random_mode: stored_variable
                .random_mode
                .as_deref()
                .and_then(RandomMode::parse),
            fixed_value: stored_variable.fixed_value.as_deref(),
        })
    }
}

/// The resolved `vars`, and a problem for each variable that could not be resolved.
pub struct ResolvedVariables {
    pub values: Map<String, Value>,
    pub problems: Vec<TemplateProblem>,
}

fn invalid_value(message: &str) -> TemplateProblem {
    TemplateProblem {
        severity: sendmock_core::TemplateProblemSeverity::Error,
        message: message.to_owned(),
        line: None,
        column: None,
    }
}

/// One variable's value against a template context (which holds the `vars` so far).
pub fn resolve_variable_value(
    variable_definition: &VariableDefinition,
    template_context: &Value,
    template_functions: &dyn TemplateFunctions,
    render_mode: TemplateRenderMode,
) -> Result<Value, TemplateProblem> {
    let value_text = variable_definition.value;
    match variable_definition.kind {
        VariableKind::Text | VariableKind::Secret | VariableKind::Prompt => {
            Ok(Value::from(value_text))
        }
        VariableKind::Number => value_text
            .trim()
            .parse::<serde_json::Number>()
            .map(Value::Number)
            .map_err(|_| invalid_value("Enter a number")),
        VariableKind::Boolean => Ok(Value::Bool(value_text.trim() == "true")),
        VariableKind::Json => {
            serde_json::from_str(value_text).map_err(|_| invalid_value("Enter valid JSON"))
        }
        VariableKind::Random if variable_definition.random_mode == Some(RandomMode::Fixed) => {
            match variable_definition.fixed_value {
                Some(fixed_value) => Ok(Value::from(fixed_value)),
                None => evaluate_template_expression(
                    value_text,
                    template_context,
                    template_functions,
                    render_mode,
                ),
            }
        }
        VariableKind::Dynamic | VariableKind::Random => evaluate_template_expression(
            value_text,
            template_context,
            template_functions,
            render_mode,
        ),
        VariableKind::Computed => {
            let rendered = render_template_in_mode(
                value_text,
                template_context,
                template_functions,
                TemplateEscape::None,
                render_mode,
            );
            match rendered
                .problems
                .into_iter()
                .find(|problem| problem.severity == sendmock_core::TemplateProblemSeverity::Error)
            {
                Some(render_problem) => Err(render_problem),
                None => Ok(Value::from(rendered.text)),
            }
        }
    }
}

fn with_vars(base_context: &Value, resolved_values: &Map<String, Value>) -> Value {
    let mut template_context = match base_context {
        Value::Object(context_fields) => context_fields.clone(),
        _ => Map::new(),
    };
    template_context.insert("vars".to_owned(), Value::Object(resolved_values.clone()));
    Value::Object(template_context)
}

/// Resolves global and endpoint variables (an endpoint's own definition replaces a global one
/// of the same name) with the send-time values on top.
pub fn resolve_template_variables(
    stored_variables: &[WebhookVariableRecord],
    send_time_values: &Map<String, Value>,
    base_context: &Value,
    template_functions: &dyn TemplateFunctions,
    render_mode: TemplateRenderMode,
) -> ResolvedVariables {
    let mut variables_by_name: BTreeMap<&str, &WebhookVariableRecord> = BTreeMap::new();
    for stored_variable in stored_variables {
        let should_keep_existing = variables_by_name
            .get(stored_variable.name.as_str())
            .is_some_and(|_| stored_variable.endpoint_id.is_none());
        if !should_keep_existing {
            variables_by_name.insert(&stored_variable.name, stored_variable);
        }
    }
    let mut effective_variables: Vec<&WebhookVariableRecord> =
        variables_by_name.into_values().collect();
    // Computed templates go last, so they can read every other value.
    effective_variables.sort_by_key(|stored_variable| stored_variable.kind == "computed");
    let mut resolved = ResolvedVariables {
        values: Map::new(),
        problems: Vec::new(),
    };
    for stored_variable in effective_variables {
        let resolved_value = match send_time_values.get(&stored_variable.name) {
            Some(send_time_value) => send_time_value.clone(),
            None => resolve_stored_variable(
                stored_variable,
                &mut resolved,
                base_context,
                template_functions,
                render_mode,
            ),
        };
        resolved
            .values
            .insert(stored_variable.name.clone(), resolved_value);
    }
    for (variable_name, send_time_value) in send_time_values {
        resolved
            .values
            .entry(variable_name.clone())
            .or_insert_with(|| send_time_value.clone());
    }
    resolved
}

fn resolve_stored_variable(
    stored_variable: &WebhookVariableRecord,
    resolved: &mut ResolvedVariables,
    base_context: &Value,
    template_functions: &dyn TemplateFunctions,
    render_mode: TemplateRenderMode,
) -> Value {
    let Some(variable_definition) = VariableDefinition::from_record(stored_variable) else {
        return Value::Null;
    };
    let template_context = with_vars(base_context, &resolved.values);
    match resolve_variable_value(
        &variable_definition,
        &template_context,
        template_functions,
        render_mode,
    ) {
        Ok(resolved_value) => resolved_value,
        Err(variable_problem) => {
            resolved.problems.push(TemplateProblem {
                message: format!(
                    "vars.{}: {}",
                    stored_variable.name, variable_problem.message
                ),
                ..variable_problem
            });
            Value::Null
        }
    }
}
