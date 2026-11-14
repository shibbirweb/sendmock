use super::message_rule_checks::{
    build_new_rule, check_message_rule, clean_addresses, find_rule_or_not_found, write_filter_json,
};
use super::message_rule_inputs::{
    ForwardRuleInput, ForwardRuleUpdate, MessageRuleMoveInput, MessageRuleReference,
};
use super::message_rule_views::ForwardRule;
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

const FORWARD_RULE: &str = "forward rule";

fn find_address_problem(addresses: &[String]) -> Option<(&'static str, &'static str)> {
    addresses
        .is_empty()
        .then_some(("to", "Add at least one address to forward to"))
}

async fn list_forward_rules(
    operation_context: &OperationContext,
) -> Result<Vec<ForwardRule>, OperationError> {
    let stored_rules = operation_context
        .email_stores
        .forward_rules
        .list_rules()
        .await?;
    Ok(stored_rules.into_iter().map(ForwardRule::from).collect())
}

pub struct ListForwardRulesOperation;

impl Operation for ListForwardRulesOperation {
    type Input = NoInput;
    type Output = Vec<ForwardRule>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getForwardRules",
            method: HttpMethod::Get,
            path: "/api/v1/forward-rules",
            summary: "Every forward rule, in the order they run.",
            is_read_only: true,
            cli_usage: "sendmock email forward-rules list",
            mcp_tool: "sendmock_forward_rule_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<ForwardRule>, OperationError> {
        list_forward_rules(operation_context).await
    }
}

pub struct CreateForwardRuleOperation;

impl Operation for CreateForwardRuleOperation {
    type Input = ForwardRuleInput;
    type Output = ForwardRule;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postForwardRules",
            method: HttpMethod::Post,
            path: "/api/v1/forward-rules",
            summary: "Add a forward rule at the end of the list.",
            cli_usage: "sendmock email forward-rules create",
            mcp_tool: "sendmock_forward_rule_create",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ForwardRuleInput,
    ) -> Result<ForwardRule, OperationError> {
        let addresses = clean_addresses(input.to);
        check_message_rule(
            &input.name,
            input.filter.as_ref(),
            find_address_problem(&addresses),
        )?;
        let new_rule = build_new_rule(
            operation_context,
            &input.name,
            input.filter.as_ref(),
            serde_json::to_string(&addresses).unwrap_or_default(),
            input.is_enabled,
        );
        let stored_rule = operation_context
            .email_stores
            .forward_rules
            .insert_rule(new_rule)
            .await?;
        Ok(ForwardRule::from(stored_rule))
    }
}

pub struct UpdateForwardRuleOperation;

impl Operation for UpdateForwardRuleOperation {
    type Input = ForwardRuleUpdate;
    type Output = ForwardRule;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchForwardRulesByRuleId",
            method: HttpMethod::Patch,
            path: "/api/v1/forward-rules/{ruleId}",
            summary: "Change a forward rule, or switch it on or off.",
            cli_usage: "sendmock email forward-rules update <ruleId>",
            mcp_tool: "sendmock_forward_rule_update",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: ForwardRuleUpdate,
    ) -> Result<ForwardRule, OperationError> {
        let forward_rules = &operation_context.email_stores.forward_rules;
        let stored_rule =
            find_rule_or_not_found(forward_rules, &input.rule_id, FORWARD_RULE).await?;
        let current_rule = ForwardRule::from(stored_rule.clone());
        let filter = input.filter.unwrap_or(current_rule.filter);
        let addresses = clean_addresses(input.to.unwrap_or(current_rule.to));
        let name = input.name.unwrap_or(current_rule.name);
        check_message_rule(&name, filter.as_ref(), find_address_problem(&addresses))?;
        let changed_rule = sendmock_store::MessageRuleRecord {
            name: name.trim().to_owned(),
            filter_json: write_filter_json(filter.as_ref()),
            action: serde_json::to_string(&addresses).unwrap_or_default(),
            is_enabled: input.is_enabled.unwrap_or(current_rule.is_enabled),
            ..stored_rule
        };
        forward_rules.update_rule(changed_rule.clone()).await?;
        Ok(ForwardRule::from(changed_rule))
    }
}

pub struct DeleteForwardRuleOperation;

impl Operation for DeleteForwardRuleOperation {
    type Input = MessageRuleReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteForwardRulesByRuleId",
            method: HttpMethod::Delete,
            path: "/api/v1/forward-rules/{ruleId}",
            summary: "Delete a forward rule.",
            is_destructive: true,
            cli_usage: "sendmock email forward-rules delete <ruleId>",
            mcp_tool: "sendmock_forward_rule_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: MessageRuleReference,
    ) -> Result<NoContent, OperationError> {
        let forward_rules = &operation_context.email_stores.forward_rules;
        if !forward_rules.delete_rule(&input.rule_id).await? {
            find_rule_or_not_found(forward_rules, &input.rule_id, FORWARD_RULE).await?;
        }
        Ok(NoContent)
    }
}

pub struct MoveForwardRuleOperation;

impl Operation for MoveForwardRuleOperation {
    type Input = MessageRuleMoveInput;
    type Output = Vec<ForwardRule>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postForwardRulesByRuleIdMove",
            method: HttpMethod::Post,
            path: "/api/v1/forward-rules/{ruleId}/move",
            summary: "Move a forward rule up or down.",
            cli_usage: "sendmock email forward-rules move <ruleId>",
            mcp_tool: "sendmock_forward_rule_move",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Answers the whole list in its new order.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: MessageRuleMoveInput,
    ) -> Result<Vec<ForwardRule>, OperationError> {
        let forward_rules = &operation_context.email_stores.forward_rules;
        if !forward_rules
            .move_rule(&input.rule_id, input.direction.to_rule_move_direction())
            .await?
        {
            find_rule_or_not_found(forward_rules, &input.rule_id, FORWARD_RULE).await?;
        }
        list_forward_rules(operation_context).await
    }
}
