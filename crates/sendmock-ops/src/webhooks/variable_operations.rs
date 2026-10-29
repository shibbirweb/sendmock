use sendmock_core::{StandardTemplateFunctions, TemplateRenderMode, evaluate_template_expression};
use sendmock_store::WebhookVariableRecord;
use serde_json::Value;

use super::template_context::build_sample_template_context;
use super::variable_inputs::{
    RandomMode, VariableKind, WebhookVariableInput, WebhookVariableListQuery,
    WebhookVariableReference, WebhookVariableUpdate,
};
use super::variable_validation::validate_variable;
use super::variable_view::{WebhookVariable, build_variable_view};
use crate::{
    HttpMethod, NoContent, Operation, OperationContext, OperationDefinition, OperationError,
    SuccessStatus,
};

/// The REST API cannot tell the UI, CLI and agents apart yet.
const CREATED_THROUGH_API: &str = "api";

pub(super) fn variable_definition(
    operation_id: &'static str,
    method: HttpMethod,
    path: &'static str,
    summary: &'static str,
    cli_usage: &'static str,
    mcp_tool: &'static str,
) -> OperationDefinition {
    OperationDefinition {
        operation_id,
        method,
        path,
        summary,
        cli_usage,
        mcp_tool,
        ..OperationDefinition::DEFAULTS
    }
}

pub(super) async fn find_stored_variable(
    operation_context: &OperationContext,
    variable_id: &str,
) -> Result<WebhookVariableRecord, OperationError> {
    operation_context
        .webhook_variable_repository
        .find_variable(variable_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No webhook variable with id {variable_id}"),
        })
}

/// A new value from a Fixed random variable's generator, against the sample.
pub(super) async fn generate_fixed_value(
    operation_context: &OperationContext,
    generator_text: &str,
) -> Result<String, OperationError> {
    let sample_context = Value::Object(build_sample_template_context(operation_context).await?);
    let template_functions = StandardTemplateFunctions::new(
        operation_context.clock.clone(),
        operation_context.random_source.clone(),
    );
    let generated_value = evaluate_template_expression(
        generator_text,
        &sample_context,
        &template_functions,
        TemplateRenderMode::Lenient,
    )
    .map_err(|render_problem| OperationError::InvalidInput {
        message: render_problem.message,
        field: Some("value".to_owned()),
    })?;
    Ok(match generated_value {
        Value::String(generated_text) => generated_text,
        other_value => other_value.to_string(),
    })
}

fn is_fixed_random(variable_input: &WebhookVariableInput) -> bool {
    variable_input.kind == VariableKind::Random
        && variable_input.random_mode == Some(RandomMode::Fixed)
}

pub struct ListWebhookVariablesOperation;

impl Operation for ListWebhookVariablesOperation {
    type Input = WebhookVariableListQuery;
    type Output = Vec<WebhookVariable>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..variable_definition(
                "getWebhooksVariables",
                HttpMethod::Get,
                "/api/v1/webhooks/variables",
                "Global and endpoint variables; secret values are masked.",
                "sendmock webhook var list",
                "sendmock_webhook_variable_list",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookVariableListQuery,
    ) -> Result<Vec<WebhookVariable>, OperationError> {
        operation_context
            .webhook_variable_repository
            .list_variables(input.endpoint_id.as_deref())
            .await?
            .into_iter()
            .map(build_variable_view)
            .collect()
    }
}

pub struct CreateWebhookVariableOperation;

impl Operation for CreateWebhookVariableOperation {
    type Input = WebhookVariableInput;
    type Output = WebhookVariable;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            success_status: SuccessStatus::Created,
            ..variable_definition(
                "postWebhooksVariables",
                HttpMethod::Post,
                "/api/v1/webhooks/variables",
                "Add a variable.",
                "sendmock webhook var set <name> <value>",
                "sendmock_webhook_variable_set",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookVariableInput,
    ) -> Result<WebhookVariable, OperationError> {
        let endpoint_id = validate_variable(operation_context, &input, None).await?;
        let fixed_value = if is_fixed_random(&input) {
            Some(generate_fixed_value(operation_context, &input.value).await?)
        } else {
            None
        };
        let new_variable = WebhookVariableRecord {
            variable_id: operation_context.id_generator.generate_id().to_string(),
            name: input.name,
            kind: input.kind.as_str().to_owned(),
            endpoint_id,
            value: input.value,
            random_mode: input
                .random_mode
                .filter(|_| input.kind == VariableKind::Random)
                .map(|mode| mode.as_str().to_owned()),
            fixed_value,
            description: input.description.trim().to_owned(),
            created_by: CREATED_THROUGH_API.to_owned(),
            created_at_unix_ms: operation_context.clock.now_unix_ms(),
        };
        operation_context
            .webhook_variable_repository
            .insert_variable(new_variable.clone())
            .await?;
        build_variable_view(new_variable)
    }
}

pub struct UpdateWebhookVariableOperation;

impl Operation for UpdateWebhookVariableOperation {
    type Input = WebhookVariableUpdate;
    type Output = WebhookVariable;

    fn definition(&self) -> OperationDefinition {
        variable_definition(
            "patchWebhooksVariablesByVariableId",
            HttpMethod::Patch,
            "/api/v1/webhooks/variables/{variableId}",
            "Change a variable.",
            "sendmock webhook var update <variableId>",
            "sendmock_webhook_variable_update",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookVariableUpdate,
    ) -> Result<WebhookVariable, OperationError> {
        let stored_variable = find_stored_variable(operation_context, &input.variable_id).await?;
        let changes = input.changes;
        let endpoint_id =
            validate_variable(operation_context, &changes, Some(&stored_variable)).await?;
        let random_mode = changes
            .random_mode
            .filter(|_| changes.kind == VariableKind::Random)
            .map(|mode| mode.as_str().to_owned());
        let is_same_generator =
            stored_variable.value == changes.value && stored_variable.random_mode == random_mode;
        let fixed_value = match (is_fixed_random(&changes), &stored_variable.fixed_value) {
            (true, Some(kept_value)) if is_same_generator => Some(kept_value.clone()),
            (true, _) => Some(generate_fixed_value(operation_context, &changes.value).await?),
            (false, _) => None,
        };
        let is_keeping_stored_secret =
            changes.kind == VariableKind::Secret && changes.value.is_empty();
        let changed_variable = WebhookVariableRecord {
            name: changes.name,
            kind: changes.kind.as_str().to_owned(),
            endpoint_id,
            value: if is_keeping_stored_secret {
                stored_variable.value.clone()
            } else {
                changes.value
            },
            random_mode,
            fixed_value,
            description: changes.description.trim().to_owned(),
            ..stored_variable
        };
        operation_context
            .webhook_variable_repository
            .update_variable(changed_variable.clone())
            .await?;
        build_variable_view(changed_variable)
    }
}

pub struct DeleteWebhookVariableOperation;

impl Operation for DeleteWebhookVariableOperation {
    type Input = WebhookVariableReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_destructive: true,
            success_status: SuccessStatus::NoContent,
            ..variable_definition(
                "deleteWebhooksVariablesByVariableId",
                HttpMethod::Delete,
                "/api/v1/webhooks/variables/{variableId}",
                "Delete a variable.",
                "sendmock webhook var unset <variableId>",
                "sendmock_webhook_variable_unset",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookVariableReference,
    ) -> Result<NoContent, OperationError> {
        let was_deleted = operation_context
            .webhook_variable_repository
            .delete_variable(&input.variable_id)
            .await?;
        if !was_deleted {
            return Err(OperationError::NotFound {
                message: format!("No webhook variable with id {}", input.variable_id),
            });
        }
        Ok(NoContent)
    }
}
