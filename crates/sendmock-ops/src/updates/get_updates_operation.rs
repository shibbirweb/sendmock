use super::update_check_result::UpdateCheckResult;
use crate::{
    HttpMethod, NoInput, Operation, OperationContext, OperationDefinition, OperationError,
};

pub struct GetUpdatesOperation;

impl Operation for GetUpdatesOperation {
    type Input = NoInput;
    type Output = UpdateCheckResult;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getUpdates",
            method: HttpMethod::Get,
            path: "/api/v1/updates",
            summary: "Whether a newer release exists for this channel, with its notes and upgrade command.",
            is_read_only: true,
            cli_usage: "sendmock update check",
            mcp_tool: "sendmock_update_check",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<UpdateCheckResult, OperationError> {
        operation_context
            .update_checker
            .check(operation_context)
            .await
    }
}
