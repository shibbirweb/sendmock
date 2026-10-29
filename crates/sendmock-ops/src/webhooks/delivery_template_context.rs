//! The whole context an endpoint request renders against: the event, `endpoint`, `delivery`,
//! `rule`, `sendmock`, `request_id` and the resolved `vars`
//! ([12](docs/plan/12-webhook-variables.md#built-in-dynamic-context)).

use sendmock_core::{TemplateFunctions, TemplateRenderMode};
use serde_json::{Map, Value, json};

use super::delivery_queue::DeliveryTrigger;
use super::request_part_renderer::RenderProblem;
use super::template_context::build_event_template_context;
use super::variable_resolution::resolve_template_variables;
use crate::{AppEvent, OperationContext, OperationError};

/// Who a delivery goes to and why, for the context.
pub struct DeliveryContextDetails<'details> {
    pub app_event: &'details AppEvent,
    /// A saved endpoint's own variables are read too; None for an unsaved one.
    pub endpoint_id: Option<&'details str>,
    pub endpoint_name: &'details str,
    pub endpoint_url: &'details str,
    pub delivery_id: &'details str,
    pub delivery_trigger: DeliveryTrigger,
    pub rule_id: Option<&'details str>,
    /// Unique to the delivery and the same on every retry.
    pub request_id: &'details str,
    /// Values typed for this send; they win over every variable (WH-07.2).
    pub send_time_values: &'details Map<String, Value>,
}

pub struct DeliveryTemplateContext {
    pub template_context: Value,
    /// A variable that could not resolve, under the source `vars`.
    pub variable_problems: Vec<RenderProblem>,
}

async fn read_rule_name(
    operation_context: &OperationContext,
    rule_id: Option<&str>,
) -> Result<Option<String>, OperationError> {
    let Some(rule_id) = rule_id else {
        return Ok(None);
    };
    let stored_rule = operation_context
        .webhook_rule_repository
        .find_rule(rule_id)
        .await?;
    Ok(stored_rule.map(|stored_rule| stored_rule.name))
}

async fn build_base_context(
    operation_context: &OperationContext,
    details: &DeliveryContextDetails<'_>,
) -> Result<Map<String, Value>, OperationError> {
    let instance_details = &operation_context.instance_details;
    let mut template_context = build_event_template_context(details.app_event);
    let rule_name = read_rule_name(operation_context, details.rule_id).await?;
    template_context.insert(
        "endpoint".to_owned(),
        json!({ "name": details.endpoint_name, "url": details.endpoint_url }),
    );
    template_context.insert(
        "delivery".to_owned(),
        json!({
            "id": details.delivery_id,
            "attempt": 1,
            "trigger": details.delivery_trigger.as_str(),
        }),
    );
    template_context.insert(
        "rule".to_owned(),
        json!({ "id": details.rule_id, "name": rule_name }),
    );
    template_context.insert(
        "sendmock".to_owned(),
        json!({
            "version": instance_details.version,
            "http_url": format!("http://{}", instance_details.http_address),
        }),
    );
    template_context.insert("request_id".to_owned(), Value::from(details.request_id));
    Ok(template_context)
}

/// The context with every variable resolved; variables can read the rest of the context.
pub async fn build_delivery_template_context(
    operation_context: &OperationContext,
    details: &DeliveryContextDetails<'_>,
    template_functions: &dyn TemplateFunctions,
    render_mode: TemplateRenderMode,
) -> Result<DeliveryTemplateContext, OperationError> {
    let mut template_context = build_base_context(operation_context, details).await?;
    let variable_repository = &operation_context.webhook_variable_repository;
    let stored_variables = match details.endpoint_id {
        Some(endpoint_id) => {
            variable_repository
                .list_endpoint_scope_variables(endpoint_id)
                .await?
        }
        None => variable_repository
            .list_variables(None)
            .await?
            .into_iter()
            .filter(|stored_variable| stored_variable.endpoint_id.is_none())
            .collect(),
    };
    let resolved_variables = resolve_template_variables(
        &stored_variables,
        details.send_time_values,
        &Value::Object(template_context.clone()),
        template_functions,
        render_mode,
    );
    template_context.insert("vars".to_owned(), Value::Object(resolved_variables.values));
    Ok(DeliveryTemplateContext {
        template_context: Value::Object(template_context),
        variable_problems: resolved_variables
            .problems
            .into_iter()
            .map(|variable_problem| RenderProblem::from_template_problem(variable_problem, "vars"))
            .collect(),
    })
}
