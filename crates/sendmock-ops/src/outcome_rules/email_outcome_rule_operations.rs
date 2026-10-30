use super::email_outcome_rule_inputs::{EmailOutcomeRuleInput, EmailOutcomeRuleUpdate};
use super::email_outcome_rule_validation::normalize_and_validate;
use super::email_outcome_rule_view::EmailOutcomeRule;
use super::outcome_rule_inputs::OutcomeRuleReference;
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, OperationSelector, SuccessStatus,
};

/// The email operations share their MCP tools with the SMS ones, told apart by `channel`.
pub const EMAIL_CHANNEL_SELECTOR: Option<OperationSelector> =
    Some(OperationSelector::by_value("channel", "email"));
/// Who created a rule; the REST API cannot tell the UI, CLI and agents apart yet.
const CREATED_THROUGH_API: &str = "api";

pub async fn find_email_rule_or_not_found(
    operation_context: &OperationContext,
    rule_id: &str,
) -> Result<sendmock_store::EmailOutcomeRuleRecord, OperationError> {
    operation_context
        .email_outcome_rule_repository
        .find_rule(rule_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No email outcome rule with id {rule_id}"),
        })
}

pub struct ListEmailOutcomeRulesOperation;

impl Operation for ListEmailOutcomeRulesOperation {
    type Input = NoInput;
    type Output = Vec<EmailOutcomeRule>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getOutcomeRulesEmail",
            method: HttpMethod::Get,
            path: "/api/v1/outcome-rules/email",
            summary: "Email outcome rules, checked from top to bottom.",
            is_read_only: true,
            cli_usage: "sendmock outcome-rule email list",
            mcp_tool: "sendmock_outcome_rule_list",
            selector: EMAIL_CHANNEL_SELECTOR,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<EmailOutcomeRule>, OperationError> {
        let stored_rules = operation_context
            .email_outcome_rule_repository
            .list_rules()
            .await?;
        Ok(stored_rules
            .into_iter()
            .map(EmailOutcomeRule::from)
            .collect())
    }
}

pub struct CreateEmailOutcomeRuleOperation;

impl Operation for CreateEmailOutcomeRuleOperation {
    type Input = EmailOutcomeRuleInput;
    type Output = EmailOutcomeRule;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postOutcomeRulesEmail",
            method: HttpMethod::Post,
            path: "/api/v1/outcome-rules/email",
            summary: "Add an email outcome rule.",
            cli_usage: "sendmock outcome-rule email create",
            mcp_tool: "sendmock_outcome_rule_create",
            selector: EMAIL_CHANNEL_SELECTOR,
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Adds the rule at the bottom of the list, so existing rules keep winning.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailOutcomeRuleInput,
    ) -> Result<EmailOutcomeRule, OperationError> {
        let new_rule = normalize_and_validate(sendmock_store::EmailOutcomeRuleRecord {
            rule_id: operation_context.id_generator.generate_id().to_string(),
            position: 0,
            pattern: input.pattern,
            outcome: input.outcome.to_rule_outcome().as_str().to_owned(),
            smtp_code: input.smtp_code,
            diagnostic: input.diagnostic,
            note: input.note,
            is_enabled: input.is_enabled,
            created_by: CREATED_THROUGH_API.to_owned(),
            created_at_unix_ms: operation_context.clock.now_unix_ms(),
        })?;
        let stored_rule = operation_context
            .email_outcome_rule_repository
            .insert_rule(new_rule)
            .await?;
        Ok(EmailOutcomeRule::from(stored_rule))
    }
}

pub struct UpdateEmailOutcomeRuleOperation;

impl Operation for UpdateEmailOutcomeRuleOperation {
    type Input = EmailOutcomeRuleUpdate;
    type Output = EmailOutcomeRule;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchOutcomeRulesEmailByRuleId",
            method: HttpMethod::Patch,
            path: "/api/v1/outcome-rules/email/{ruleId}",
            summary: "Change an email outcome rule; send only the changed keys.",
            cli_usage: "sendmock outcome-rule email update <ruleId>",
            mcp_tool: "sendmock_outcome_rule_update",
            selector: EMAIL_CHANNEL_SELECTOR,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailOutcomeRuleUpdate,
    ) -> Result<EmailOutcomeRule, OperationError> {
        let mut changed_rule =
            find_email_rule_or_not_found(operation_context, &input.rule_id).await?;
        if let Some(outcome) = input.outcome {
            changed_rule.outcome = outcome.to_rule_outcome().as_str().to_owned();
        }
        changed_rule.pattern = input.pattern.unwrap_or(changed_rule.pattern);
        changed_rule.smtp_code = input.smtp_code.unwrap_or(changed_rule.smtp_code);
        changed_rule.diagnostic = input.diagnostic.unwrap_or(changed_rule.diagnostic);
        changed_rule.note = input.note.unwrap_or(changed_rule.note);
        changed_rule.is_enabled = input.is_enabled.unwrap_or(changed_rule.is_enabled);
        let changed_rule = normalize_and_validate(changed_rule)?;
        operation_context
            .email_outcome_rule_repository
            .update_rule(changed_rule.clone())
            .await?;
        Ok(EmailOutcomeRule::from(changed_rule))
    }
}

pub struct DeleteEmailOutcomeRuleOperation;

impl Operation for DeleteEmailOutcomeRuleOperation {
    type Input = OutcomeRuleReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteOutcomeRulesEmailByRuleId",
            method: HttpMethod::Delete,
            path: "/api/v1/outcome-rules/email/{ruleId}",
            summary: "Delete an email outcome rule.",
            is_destructive: true,
            cli_usage: "sendmock outcome-rule email delete <ruleId>",
            mcp_tool: "sendmock_outcome_rule_delete",
            selector: EMAIL_CHANNEL_SELECTOR,
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
            .email_outcome_rule_repository
            .delete_rule(&input.rule_id)
            .await?;
        Ok(NoContent)
    }
}
