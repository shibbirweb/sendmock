use schemars::JsonSchema;
use sendmock_core::{
    StandardTemplateFunctions, TemplateEscape, TemplateProblemSeverity, TemplateRenderMode,
    render_template,
};
use serde::Serialize;
use serde_json::{Map, Value};

use super::template_context::build_sample_template_context;
use super::variable_inputs::{
    RandomMode, VariableKind, VariablePreviewRequest, WebhookVariableReference,
};
use super::variable_operations::{find_stored_variable, generate_fixed_value, variable_definition};
use super::variable_resolution::{
    VariableDefinition, resolve_template_variables, resolve_variable_value,
};
use super::variable_validation::find_value_problem;
use super::variable_view::{WebhookVariable, build_variable_view};
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

pub struct RegenerateWebhookVariableOperation;

impl Operation for RegenerateWebhookVariableOperation {
    type Input = WebhookVariableReference;
    type Output = WebhookVariable;

    fn definition(&self) -> OperationDefinition {
        variable_definition(
            "postWebhooksVariablesByVariableIdRegenerate",
            HttpMethod::Post,
            "/api/v1/webhooks/variables/{variableId}/regenerate",
            "Make a new fixed value for a generated-once random variable.",
            "sendmock webhook var regenerate <variableId>",
            "sendmock_webhook_variable_regenerate",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookVariableReference,
    ) -> Result<WebhookVariable, OperationError> {
        let stored_variable = find_stored_variable(operation_context, &input.variable_id).await?;
        let is_fixed_random = stored_variable.kind == VariableKind::Random.as_str()
            && stored_variable.random_mode.as_deref() == Some(RandomMode::Fixed.as_str());
        if !is_fixed_random {
            return Err(OperationError::Conflict {
                code: "not_fixed_random",
                message: "Only a Fixed random variable can be regenerated.".to_owned(),
            });
        }
        let regenerated_variable = sendmock_store::WebhookVariableRecord {
            fixed_value: Some(
                generate_fixed_value(operation_context, &stored_variable.value).await?,
            ),
            ..stored_variable
        };
        operation_context
            .webhook_variable_repository
            .update_variable(regenerated_variable.clone())
            .await?;
        build_variable_view(regenerated_variable)
    }
}

/// What a variable definition resolves to against the sample.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct VariablePreviewResult {
    pub resolved_value: String,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

fn preview_problem(error_message: &str) -> VariablePreviewResult {
    VariablePreviewResult {
        resolved_value: String::new(),
        warnings: Vec::new(),
        errors: vec![error_message.to_owned()],
    }
}

pub struct PreviewWebhookVariableOperation;

impl Operation for PreviewWebhookVariableOperation {
    type Input = VariablePreviewRequest;
    type Output = VariablePreviewResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..variable_definition(
                "postWebhooksVariablesPreview",
                HttpMethod::Post,
                "/api/v1/webhooks/variables/preview",
                "What a variable definition resolves to against the sample.",
                "sendmock webhook var preview",
                "sendmock_webhook_variable_preview",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: VariablePreviewRequest,
    ) -> Result<VariablePreviewResult, OperationError> {
        if input.kind == VariableKind::Secret {
            return Ok(VariablePreviewResult {
                resolved_value: "••••••••".to_owned(),
                warnings: Vec::new(),
                errors: Vec::new(),
            });
        }
        if let Some(value_problem) = find_value_problem(input.kind, &input.value) {
            return Ok(preview_problem(value_problem));
        }
        let template_functions = StandardTemplateFunctions::new(
            operation_context.clock.clone(),
            operation_context.random_source.clone(),
        );
        let preview_context = build_preview_context(operation_context, &template_functions).await?;
        if input.kind == VariableKind::Computed {
            return Ok(preview_computed_template(
                &input.value,
                &preview_context,
                &template_functions,
            ));
        }
        let variable_definition = VariableDefinition {
            kind: input.kind,
            value: &input.value,
            random_mode: None,
            fixed_value: None,
        };
        let resolution = resolve_variable_value(
            &variable_definition,
            &preview_context,
            &template_functions,
            TemplateRenderMode::Lenient,
        );
        Ok(match resolution {
            Ok(Value::Null) => VariablePreviewResult {
                resolved_value: String::new(),
                warnings: vec![format!("{} is not in the sample", input.value.trim())],
                errors: Vec::new(),
            },
            Ok(resolved_value) => VariablePreviewResult {
                resolved_value: to_preview_text(resolved_value),
                warnings: Vec::new(),
                errors: Vec::new(),
            },
            Err(render_problem) => preview_problem(&render_problem.message),
        })
    }
}

fn to_preview_text(resolved_value: Value) -> String {
    match resolved_value {
        Value::String(resolved_text) => resolved_text,
        other_value => other_value.to_string(),
    }
}

/// The sample event with the global variables as `vars`, so a Computed template can read them.
async fn build_preview_context(
    operation_context: &OperationContext,
    template_functions: &StandardTemplateFunctions,
) -> Result<Value, OperationError> {
    let mut preview_context = build_sample_template_context(operation_context).await?;
    let global_variables: Vec<_> = operation_context
        .webhook_variable_repository
        .list_variables(None)
        .await?
        .into_iter()
        .filter(|stored_variable| stored_variable.endpoint_id.is_none())
        .collect();
    let resolved_variables = resolve_template_variables(
        &global_variables,
        &Map::new(),
        &Value::Object(preview_context.clone()),
        template_functions,
        TemplateRenderMode::Lenient,
    );
    preview_context.insert("vars".to_owned(), Value::Object(resolved_variables.values));
    Ok(Value::Object(preview_context))
}

fn preview_computed_template(
    template_text: &str,
    preview_context: &Value,
    template_functions: &StandardTemplateFunctions,
) -> VariablePreviewResult {
    let rendered = render_template(
        template_text,
        preview_context,
        template_functions,
        TemplateEscape::None,
    );
    let messages_of = |severity: TemplateProblemSeverity| {
        rendered
            .problems
            .iter()
            .filter(|problem| problem.severity == severity)
            .map(|problem| problem.message.clone())
            .collect()
    };
    VariablePreviewResult {
        warnings: messages_of(TemplateProblemSeverity::Warning),
        errors: messages_of(TemplateProblemSeverity::Error),
        resolved_value: rendered.text.clone(),
    }
}
