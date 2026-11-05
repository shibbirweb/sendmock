use super::message_rule_checks::{
    build_new_rule, check_message_rule, find_rule_or_not_found, write_filter_json,
};
use super::message_rule_inputs::{
    MessageRuleMoveInput, MessageRuleReference, TagRuleInput, TagRuleUpdate,
};
use super::message_rule_views::TagRule;
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

const TAG_RULE: &str = "tag rule";

fn find_tag_problem(tag: &str) -> Option<(&'static str, &'static str)> {
    tag.trim()
        .is_empty()
        .then_some(("tag", "Enter the tag to add"))
}

async fn list_tag_rules(
    operation_context: &OperationContext,
) -> Result<Vec<TagRule>, OperationError> {
    let stored_rules = operation_context
        .email_stores
        .tag_rules
        .list_rules()
        .await?;
    Ok(stored_rules.into_iter().map(TagRule::from).collect())
}

pub struct ListTagRulesOperation;

impl Operation for ListTagRulesOperation {
    type Input = NoInput;
    type Output = Vec<TagRule>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getTagRules",
            method: HttpMethod::Get,
            path: "/api/v1/tag-rules",
            summary: "Every tag rule, in the order they run.",
            is_read_only: true,
            cli_usage: "sendmock email tag-rules list",
            mcp_tool: "sendmock_tag_rule_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<TagRule>, OperationError> {
        list_tag_rules(operation_context).await
    }
}

pub struct CreateTagRuleOperation;

impl Operation for CreateTagRuleOperation {
    type Input = TagRuleInput;
    type Output = TagRule;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postTagRules",
            method: HttpMethod::Post,
            path: "/api/v1/tag-rules",
            summary: "Add a tag rule at the end of the list.",
            cli_usage: "sendmock email tag-rules create",
            mcp_tool: "sendmock_tag_rule_create",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: TagRuleInput,
    ) -> Result<TagRule, OperationError> {
        check_message_rule(
            &input.name,
            input.filter.as_ref(),
            find_tag_problem(&input.tag),
        )?;
        let new_rule = build_new_rule(
            operation_context,
            &input.name,
            input.filter.as_ref(),
            input.tag.trim().to_lowercase(),
            input.is_enabled,
        );
        let stored_rule = operation_context
            .email_stores
            .tag_rules
            .insert_rule(new_rule)
            .await?;
        Ok(TagRule::from(stored_rule))
    }
}

pub struct UpdateTagRuleOperation;

impl Operation for UpdateTagRuleOperation {
    type Input = TagRuleUpdate;
    type Output = TagRule;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchTagRulesByRuleId",
            method: HttpMethod::Patch,
            path: "/api/v1/tag-rules/{ruleId}",
            summary: "Change a tag rule, or switch it on or off.",
            cli_usage: "sendmock email tag-rules update <ruleId>",
            mcp_tool: "sendmock_tag_rule_update",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: TagRuleUpdate,
    ) -> Result<TagRule, OperationError> {
        let tag_rules = &operation_context.email_stores.tag_rules;
        let stored_rule = find_rule_or_not_found(tag_rules, &input.rule_id, TAG_RULE).await?;
        let current_rule = TagRule::from(stored_rule.clone());
        let filter = input.filter.unwrap_or(current_rule.filter);
        let tag = input.tag.unwrap_or(current_rule.tag);
        let name = input.name.unwrap_or(current_rule.name);
        check_message_rule(&name, filter.as_ref(), find_tag_problem(&tag))?;
        let changed_rule = sendmock_store::MessageRuleRecord {
            name: name.trim().to_owned(),
            filter_json: write_filter_json(filter.as_ref()),
            action: tag.trim().to_lowercase(),
            is_enabled: input.is_enabled.unwrap_or(current_rule.is_enabled),
            ..stored_rule
        };
        tag_rules.update_rule(changed_rule.clone()).await?;
        Ok(TagRule::from(changed_rule))
    }
}

pub struct DeleteTagRuleOperation;

impl Operation for DeleteTagRuleOperation {
    type Input = MessageRuleReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteTagRulesByRuleId",
            method: HttpMethod::Delete,
            path: "/api/v1/tag-rules/{ruleId}",
            summary: "Delete a tag rule.",
            is_destructive: true,
            cli_usage: "sendmock email tag-rules delete <ruleId>",
            mcp_tool: "sendmock_tag_rule_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: MessageRuleReference,
    ) -> Result<NoContent, OperationError> {
        let tag_rules = &operation_context.email_stores.tag_rules;
        if !tag_rules.delete_rule(&input.rule_id).await? {
            find_rule_or_not_found(tag_rules, &input.rule_id, TAG_RULE).await?;
        }
        Ok(NoContent)
    }
}

pub struct MoveTagRuleOperation;

impl Operation for MoveTagRuleOperation {
    type Input = MessageRuleMoveInput;
    type Output = Vec<TagRule>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postTagRulesByRuleIdMove",
            method: HttpMethod::Post,
            path: "/api/v1/tag-rules/{ruleId}/move",
            summary: "Move a tag rule up or down.",
            cli_usage: "sendmock email tag-rules move <ruleId>",
            mcp_tool: "sendmock_tag_rule_move",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Answers the whole list in its new order.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: MessageRuleMoveInput,
    ) -> Result<Vec<TagRule>, OperationError> {
        let tag_rules = &operation_context.email_stores.tag_rules;
        if !tag_rules
            .move_rule(&input.rule_id, input.direction.to_rule_move_direction())
            .await?
        {
            find_rule_or_not_found(tag_rules, &input.rule_id, TAG_RULE).await?;
        }
        list_tag_rules(operation_context).await
    }
}
