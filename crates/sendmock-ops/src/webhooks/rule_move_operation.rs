use sendmock_store::RuleMoveDirection;

use super::rule_inputs::{WebhookRuleMoveDirection, WebhookRuleMoveInput};
use super::rule_operations::{list_rule_views, rule_definition};
use super::rule_view::WebhookRule;
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

pub struct MoveWebhookRuleOperation;

impl Operation for MoveWebhookRuleOperation {
    type Input = WebhookRuleMoveInput;
    type Output = Vec<WebhookRule>;

    fn definition(&self) -> OperationDefinition {
        rule_definition(
            "postWebhooksRulesByRuleIdMove",
            HttpMethod::Post,
            "/api/v1/webhooks/rules/{ruleId}/move",
            "Move a rule up or down; answers the reordered list.",
            "sendmock webhook rule move <ruleId>",
            "sendmock_webhook_rule_move",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookRuleMoveInput,
    ) -> Result<Vec<WebhookRule>, OperationError> {
        let move_direction = match input.direction {
            WebhookRuleMoveDirection::Up => RuleMoveDirection::Up,
            WebhookRuleMoveDirection::Down => RuleMoveDirection::Down,
        };
        let was_moved = operation_context
            .webhook_rule_repository
            .move_rule(&input.rule_id, move_direction)
            .await?;
        if !was_moved {
            return Err(OperationError::NotFound {
                message: format!("No webhook rule with id {}", input.rule_id),
            });
        }
        list_rule_views(operation_context).await
    }
}
