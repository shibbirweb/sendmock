use super::push_inputs::PushUpdateInput;
use super::push_views::PushNotification;
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

pub struct UpdatePushOperation;

impl Operation for UpdatePushOperation {
    type Input = PushUpdateInput;
    type Output = PushNotification;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchPushByPushId",
            method: HttpMethod::Patch,
            path: "/api/v1/push/{pushId}",
            summary: "Mark a push notification read or unread.",
            cli_usage: "sendmock push update <pushId>",
            mcp_tool: "sendmock_push_update",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PushUpdateInput,
    ) -> Result<PushNotification, OperationError> {
        let push_notifications = &operation_context.push_notifications;
        let not_found = || OperationError::NotFound {
            message: format!("No push notification with id {}", input.push_id),
        };
        if !push_notifications
            .mark_notification_read(&input.push_id, input.is_read)
            .await?
        {
            return Err(not_found());
        }
        push_notifications
            .find_notification(&input.push_id)
            .await?
            .map(PushNotification::from)
            .ok_or_else(not_found)
    }
}
