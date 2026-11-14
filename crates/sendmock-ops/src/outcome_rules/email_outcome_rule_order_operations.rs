use sendmock_mail::{AddressOutcomeSource, resolve_address_outcome};

use super::email_outcome_rule_inputs::EmailOutcomeTestRequest;
use super::email_outcome_rule_loading::load_email_outcome_rules;
use super::email_outcome_rule_operations::{EMAIL_CHANNEL_SELECTOR, find_email_rule_or_not_found};
use super::email_outcome_rule_view::EmailOutcomeRule;
use super::outcome_rule_inputs::OutcomeRuleMoveInput;
use super::outcome_test_result::OutcomeTestResult;
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

pub struct MoveEmailOutcomeRuleOperation;

impl Operation for MoveEmailOutcomeRuleOperation {
    type Input = OutcomeRuleMoveInput;
    type Output = Vec<EmailOutcomeRule>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postOutcomeRulesEmailByRuleIdMove",
            method: HttpMethod::Post,
            path: "/api/v1/outcome-rules/email/{ruleId}/move",
            summary: "Move an email outcome rule up or down.",
            cli_usage: "sendmock outcome-rule email move <ruleId>",
            mcp_tool: "sendmock_outcome_rule_move",
            selector: EMAIL_CHANNEL_SELECTOR,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Answers the whole list in its new order.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: OutcomeRuleMoveInput,
    ) -> Result<Vec<EmailOutcomeRule>, OperationError> {
        let outcome_rule_repository = &operation_context.email_outcome_rule_repository;
        if !outcome_rule_repository
            .move_rule(&input.rule_id, input.direction.to_rule_move_direction())
            .await?
        {
            find_email_rule_or_not_found(operation_context, &input.rule_id).await?;
        }
        let stored_rules = outcome_rule_repository.list_rules().await?;
        Ok(stored_rules
            .into_iter()
            .map(EmailOutcomeRule::from)
            .collect())
    }
}

pub struct TestEmailOutcomeOperation;

impl Operation for TestEmailOutcomeOperation {
    type Input = EmailOutcomeTestRequest;
    type Output = OutcomeTestResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postOutcomeRulesEmailTest",
            method: HttpMethod::Post,
            path: "/api/v1/outcome-rules/email/test",
            summary: "Which custom rule, magic address or profile decides an address's outcome.",
            is_read_only: true,
            cli_usage: "sendmock outcome-rule email test <address>",
            mcp_tool: "sendmock_outcome_rule_test",
            selector: EMAIL_CHANNEL_SELECTOR,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailOutcomeTestRequest,
    ) -> Result<OutcomeTestResult, OperationError> {
        let app_settings = operation_context.settings_store.current().await?;
        let custom_rules = load_email_outcome_rules(operation_context).await?;
        let outcome_source = resolve_address_outcome(
            input.address.trim(),
            &custom_rules,
            app_settings.is_magic_addresses_enabled,
        );
        let summary = outcome_source.describe(app_settings.email_outcome_profile.as_str());
        Ok(match outcome_source {
            AddressOutcomeSource::CustomRule(custom_rule) => {
                OutcomeTestResult::custom_rule(&custom_rule.rule_id, custom_rule.position, summary)
            }
            AddressOutcomeSource::MagicAddress(_) => OutcomeTestResult::magic(summary),
            AddressOutcomeSource::Profile => OutcomeTestResult::profile(summary),
        })
    }
}
