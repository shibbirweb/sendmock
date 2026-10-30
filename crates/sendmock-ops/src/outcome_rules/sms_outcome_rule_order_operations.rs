use sendmock_sms::{OutcomeSource, resolve_number_outcome};

use super::outcome_rule_inputs::OutcomeRuleMoveInput;
use super::outcome_test_result::OutcomeTestResult;
use super::sms_outcome_rule_inputs::SmsOutcomeTestRequest;
use super::sms_outcome_rule_operations::{SMS_CHANNEL_SELECTOR, find_rule_or_not_found};
use super::sms_outcome_rule_view::{SmsOutcomeRule, to_match_field};
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError,
    load_custom_outcome_rules, to_simulation_profile,
};

pub struct MoveSmsOutcomeRuleOperation;

impl Operation for MoveSmsOutcomeRuleOperation {
    type Input = OutcomeRuleMoveInput;
    type Output = Vec<SmsOutcomeRule>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postOutcomeRulesSmsByRuleIdMove",
            method: HttpMethod::Post,
            path: "/api/v1/outcome-rules/sms/{ruleId}/move",
            summary: "Move an SMS outcome rule up or down.",
            cli_usage: "sendmock outcome-rule sms move <ruleId>",
            mcp_tool: "sendmock_outcome_rule_move",
            selector: SMS_CHANNEL_SELECTOR,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Answers the whole list in its new order.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: OutcomeRuleMoveInput,
    ) -> Result<Vec<SmsOutcomeRule>, OperationError> {
        let move_direction = input.direction.to_rule_move_direction();
        let outcome_rule_repository = &operation_context.sms_outcome_rule_repository;
        if !outcome_rule_repository
            .move_rule(&input.rule_id, move_direction)
            .await?
        {
            find_rule_or_not_found(operation_context, &input.rule_id).await?;
        }
        let stored_rules = outcome_rule_repository.list_rules().await?;
        Ok(stored_rules.into_iter().map(SmsOutcomeRule::from).collect())
    }
}

pub struct TestSmsOutcomeOperation;

impl Operation for TestSmsOutcomeOperation {
    type Input = SmsOutcomeTestRequest;
    type Output = OutcomeTestResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postOutcomeRulesSmsTest",
            method: HttpMethod::Post,
            path: "/api/v1/outcome-rules/sms/test",
            summary: "Which custom rule, magic number or profile decides a number's outcome.",
            is_read_only: true,
            cli_usage: "sendmock outcome-rule sms test <number>",
            mcp_tool: "sendmock_outcome_rule_test",
            selector: SMS_CHANNEL_SELECTOR,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmsOutcomeTestRequest,
    ) -> Result<OutcomeTestResult, OperationError> {
        let app_settings = operation_context.settings_store.current().await?;
        let custom_rules = load_custom_outcome_rules(operation_context).await?;
        let outcome_source = resolve_number_outcome(
            input.number.trim(),
            to_match_field(input.match_field),
            &custom_rules,
            app_settings.is_magic_numbers_enabled,
        );
        let profile_name = to_simulation_profile(app_settings.sms_simulation_profile).as_str();
        let summary = outcome_source.describe(profile_name);
        Ok(match outcome_source {
            OutcomeSource::Custom(custom_rule) => {
                OutcomeTestResult::custom_rule(&custom_rule.rule_id, custom_rule.position, summary)
            }
            OutcomeSource::Magic(_) => OutcomeTestResult::magic(summary),
            OutcomeSource::Profile => OutcomeTestResult::profile(summary),
        })
    }
}
