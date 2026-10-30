use sendmock_store::WebhookRuleRecord;

use super::rule_inputs::{WebhookRuleInput, WebhookRuleReference, WebhookRuleUpdate};
use super::rule_validation::validate_rule;
use super::rule_view::{WebhookRule, build_rule_view, read_rule_events, read_rule_filter};
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

/// The REST API cannot tell the UI, CLI and agents apart yet.
const CREATED_THROUGH_API: &str = "api";

fn write_json(value: &impl serde::Serialize) -> Result<String, OperationError> {
    serde_json::to_string(value)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))
}

async fn find_stored_rule(
    operation_context: &OperationContext,
    rule_id: &str,
) -> Result<WebhookRuleRecord, OperationError> {
    operation_context
        .webhook_rule_repository
        .find_rule(rule_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No webhook rule with id {rule_id}"),
        })
}

pub(super) async fn list_rule_views(
    operation_context: &OperationContext,
) -> Result<Vec<WebhookRule>, OperationError> {
    operation_context
        .webhook_rule_repository
        .list_rules()
        .await?
        .into_iter()
        .map(build_rule_view)
        .collect()
}

pub(super) fn rule_definition(
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

pub struct ListWebhookRulesOperation;

impl Operation for ListWebhookRulesOperation {
    type Input = NoInput;
    type Output = Vec<WebhookRule>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..rule_definition(
                "getWebhooksRules",
                HttpMethod::Get,
                "/api/v1/webhooks/rules",
                "Which events go to which endpoint, checked from top to bottom.",
                "sendmock webhook rule list",
                "sendmock_webhook_rule_list",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<WebhookRule>, OperationError> {
        list_rule_views(operation_context).await
    }
}

pub struct CreateWebhookRuleOperation;

impl Operation for CreateWebhookRuleOperation {
    type Input = WebhookRuleInput;
    type Output = WebhookRule;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            success_status: SuccessStatus::Created,
            ..rule_definition(
                "postWebhooksRules",
                HttpMethod::Post,
                "/api/v1/webhooks/rules",
                "Add a rule.",
                "sendmock webhook rule create",
                "sendmock_webhook_rule_create",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookRuleInput,
    ) -> Result<WebhookRule, OperationError> {
        validate_rule(
            operation_context,
            &input.name,
            &input.endpoint_id,
            &input.events,
            input.filter.as_ref(),
        )
        .await?;
        let stored_rule = operation_context
            .webhook_rule_repository
            .insert_rule(WebhookRuleRecord {
                rule_id: operation_context.id_generator.generate_id().to_string(),
                position: 0,
                name: input.name.trim().to_owned(),
                endpoint_id: input.endpoint_id,
                events_json: write_json(&input.events)?,
                filter_json: input.filter.as_ref().map(write_json).transpose()?,
                is_enabled: input.is_enabled,
                created_by: CREATED_THROUGH_API.to_owned(),
                created_at_unix_ms: operation_context.clock.now_unix_ms(),
            })
            .await?;
        build_rule_view(stored_rule)
    }
}

pub struct GetWebhookRuleOperation;

impl Operation for GetWebhookRuleOperation {
    type Input = WebhookRuleReference;
    type Output = WebhookRule;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..rule_definition(
                "getWebhooksRulesByRuleId",
                HttpMethod::Get,
                "/api/v1/webhooks/rules/{ruleId}",
                "One webhook rule with its filter.",
                "sendmock webhook rule show <ruleId>",
                "sendmock_webhook_rule_get",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookRuleReference,
    ) -> Result<WebhookRule, OperationError> {
        build_rule_view(find_stored_rule(operation_context, &input.rule_id).await?)
    }
}

pub struct UpdateWebhookRuleOperation;

impl Operation for UpdateWebhookRuleOperation {
    type Input = WebhookRuleUpdate;
    type Output = WebhookRule;

    fn definition(&self) -> OperationDefinition {
        rule_definition(
            "patchWebhooksRulesByRuleId",
            HttpMethod::Patch,
            "/api/v1/webhooks/rules/{ruleId}",
            "Change a rule; send only the changed keys.",
            "sendmock webhook rule update <ruleId>",
            "sendmock_webhook_rule_update",
        )
    }

    /// The changed rule is checked as a whole before it is saved.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookRuleUpdate,
    ) -> Result<WebhookRule, OperationError> {
        let stored_rule = find_stored_rule(operation_context, &input.rule_id).await?;
        let name = input.name.unwrap_or(stored_rule.name.clone());
        let endpoint_id = input.endpoint_id.unwrap_or(stored_rule.endpoint_id.clone());
        let events = match input.events {
            Some(events) => events,
            None => read_rule_events(&stored_rule)?,
        };
        let filter = match input.filter {
            Some(filter) => filter,
            None => read_rule_filter(&stored_rule)?,
        };
        validate_rule(
            operation_context,
            &name,
            &endpoint_id,
            &events,
            filter.as_ref(),
        )
        .await?;
        let changed_rule = WebhookRuleRecord {
            name: name.trim().to_owned(),
            endpoint_id,
            events_json: write_json(&events)?,
            filter_json: filter.as_ref().map(write_json).transpose()?,
            is_enabled: input.is_enabled.unwrap_or(stored_rule.is_enabled),
            ..stored_rule
        };
        operation_context
            .webhook_rule_repository
            .update_rule(changed_rule.clone())
            .await?;
        build_rule_view(changed_rule)
    }
}

pub struct DeleteWebhookRuleOperation;

impl Operation for DeleteWebhookRuleOperation {
    type Input = WebhookRuleReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_destructive: true,
            success_status: SuccessStatus::NoContent,
            ..rule_definition(
                "deleteWebhooksRulesByRuleId",
                HttpMethod::Delete,
                "/api/v1/webhooks/rules/{ruleId}",
                "Delete a rule.",
                "sendmock webhook rule delete <ruleId>",
                "sendmock_webhook_rule_delete",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookRuleReference,
    ) -> Result<NoContent, OperationError> {
        let was_deleted = operation_context
            .webhook_rule_repository
            .delete_rule(&input.rule_id)
            .await?;
        if !was_deleted {
            return Err(OperationError::NotFound {
                message: format!("No webhook rule with id {}", input.rule_id),
            });
        }
        Ok(NoContent)
    }
}
