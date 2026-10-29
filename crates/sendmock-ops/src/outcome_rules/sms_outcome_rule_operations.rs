use super::sms_outcome_rule_inputs::{
    OutcomeRuleReference, SmsOutcomeRuleInput, SmsOutcomeRuleUpdate,
};
use super::sms_outcome_rule_validation::normalize_and_validate;
use super::sms_outcome_rule_view::{SmsOutcomeRule, to_match_field, to_outcome_kind};
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, OperationSelector, SuccessStatus,
};

/// The SMS operations share their MCP tools with the email ones, told apart by `channel`.
pub const SMS_CHANNEL_SELECTOR: Option<OperationSelector> = Some(OperationSelector {
    input_name: "channel",
    value: "sms",
});
/// Who created a rule; the REST API cannot tell the UI, CLI and agents apart yet.
const CREATED_THROUGH_API: &str = "api";

pub async fn find_rule_or_not_found(
    operation_context: &OperationContext,
    rule_id: &str,
) -> Result<sendmock_store::SmsOutcomeRuleRecord, OperationError> {
    operation_context
        .sms_outcome_rule_repository
        .find_rule(rule_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No SMS outcome rule with id {rule_id}"),
        })
}

pub struct ListSmsOutcomeRulesOperation;

impl Operation for ListSmsOutcomeRulesOperation {
    type Input = NoInput;
    type Output = Vec<SmsOutcomeRule>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getOutcomeRulesSms",
            method: HttpMethod::Get,
            path: "/api/v1/outcome-rules/sms",
            summary: "SMS outcome rules, checked from top to bottom.",
            is_read_only: true,
            cli_usage: "sendmock outcome-rule sms list",
            mcp_tool: "sendmock_outcome_rule_list",
            selector: SMS_CHANNEL_SELECTOR,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<SmsOutcomeRule>, OperationError> {
        let stored_rules = operation_context
            .sms_outcome_rule_repository
            .list_rules()
            .await?;
        Ok(stored_rules.into_iter().map(SmsOutcomeRule::from).collect())
    }
}

pub struct CreateSmsOutcomeRuleOperation;

impl Operation for CreateSmsOutcomeRuleOperation {
    type Input = SmsOutcomeRuleInput;
    type Output = SmsOutcomeRule;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postOutcomeRulesSms",
            method: HttpMethod::Post,
            path: "/api/v1/outcome-rules/sms",
            summary: "Add an SMS outcome rule.",
            cli_usage: "sendmock outcome-rule sms create",
            mcp_tool: "sendmock_outcome_rule_create",
            selector: SMS_CHANNEL_SELECTOR,
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Adds the rule at the bottom of the list, so existing rules keep winning.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmsOutcomeRuleInput,
    ) -> Result<SmsOutcomeRule, OperationError> {
        let new_rule = normalize_and_validate(sendmock_store::SmsOutcomeRuleRecord {
            rule_id: operation_context.id_generator.generate_id().to_string(),
            position: 0,
            match_field: to_match_field(input.match_field).as_str().to_owned(),
            pattern: input.pattern,
            outcome: to_outcome_kind(input.outcome).as_str().to_owned(),
            error_code: input.error_code,
            delay_seconds: input.delay_seconds,
            note: input.note,
            is_enabled: input.is_enabled,
            created_by: CREATED_THROUGH_API.to_owned(),
            created_at_unix_ms: operation_context.clock.now_unix_ms(),
        })?;
        let stored_rule = operation_context
            .sms_outcome_rule_repository
            .insert_rule(new_rule)
            .await?;
        Ok(SmsOutcomeRule::from(stored_rule))
    }
}

pub struct UpdateSmsOutcomeRuleOperation;

impl Operation for UpdateSmsOutcomeRuleOperation {
    type Input = SmsOutcomeRuleUpdate;
    type Output = SmsOutcomeRule;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchOutcomeRulesSmsByRuleId",
            method: HttpMethod::Patch,
            path: "/api/v1/outcome-rules/sms/{ruleId}",
            summary: "Change an SMS outcome rule; send only the changed keys.",
            cli_usage: "sendmock outcome-rule sms update <ruleId>",
            mcp_tool: "sendmock_outcome_rule_update",
            selector: SMS_CHANNEL_SELECTOR,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmsOutcomeRuleUpdate,
    ) -> Result<SmsOutcomeRule, OperationError> {
        let mut changed_rule = find_rule_or_not_found(operation_context, &input.rule_id).await?;
        if let Some(match_field) = input.match_field {
            changed_rule.match_field = to_match_field(match_field).as_str().to_owned();
        }
        if let Some(outcome) = input.outcome {
            changed_rule.outcome = to_outcome_kind(outcome).as_str().to_owned();
        }
        changed_rule.pattern = input.pattern.unwrap_or(changed_rule.pattern);
        changed_rule.error_code = input.error_code.unwrap_or(changed_rule.error_code);
        changed_rule.delay_seconds = input.delay_seconds.unwrap_or(changed_rule.delay_seconds);
        changed_rule.note = input.note.unwrap_or(changed_rule.note);
        changed_rule.is_enabled = input.is_enabled.unwrap_or(changed_rule.is_enabled);
        let changed_rule = normalize_and_validate(changed_rule)?;
        operation_context
            .sms_outcome_rule_repository
            .update_rule(changed_rule.clone())
            .await?;
        Ok(SmsOutcomeRule::from(changed_rule))
    }
}

pub struct DeleteSmsOutcomeRuleOperation;

impl Operation for DeleteSmsOutcomeRuleOperation {
    type Input = OutcomeRuleReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteOutcomeRulesSmsByRuleId",
            method: HttpMethod::Delete,
            path: "/api/v1/outcome-rules/sms/{ruleId}",
            summary: "Delete an SMS outcome rule.",
            is_destructive: true,
            cli_usage: "sendmock outcome-rule sms delete <ruleId>",
            mcp_tool: "sendmock_outcome_rule_delete",
            selector: SMS_CHANNEL_SELECTOR,
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Deleting a rule that is already gone also succeeds, so retries are safe.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: OutcomeRuleReference,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .sms_outcome_rule_repository
            .delete_rule(&input.rule_id)
            .await?;
        Ok(NoContent)
    }
}
