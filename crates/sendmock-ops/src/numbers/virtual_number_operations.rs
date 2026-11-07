use super::number_inputs::{VirtualNumberInput, VirtualNumberReference, VirtualNumberUpdate};
use super::number_views::VirtualNumber;
use super::virtual_number_builder::build_virtual_number;
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, OperationSelector, SuccessStatus,
};

pub struct ListVirtualNumbersOperation;

impl Operation for ListVirtualNumbersOperation {
    type Input = NoInput;
    type Output = Vec<VirtualNumber>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getNumbers",
            method: HttpMethod::Get,
            path: "/api/v1/numbers",
            summary: "Fake numbers your app sends from, with their webhooks.",
            is_read_only: true,
            cli_usage: "sendmock numbers list",
            mcp_tool: "sendmock_number_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<VirtualNumber>, OperationError> {
        let stored_numbers = operation_context
            .virtual_number_repository
            .list_numbers()
            .await?;
        Ok(stored_numbers
            .into_iter()
            .map(VirtualNumber::from)
            .collect())
    }
}

pub struct CreateVirtualNumberOperation;

impl Operation for CreateVirtualNumberOperation {
    type Input = VirtualNumberInput;
    type Output = VirtualNumber;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postNumbers",
            method: HttpMethod::Post,
            path: "/api/v1/numbers",
            summary: "Add a number.",
            cli_usage: "sendmock numbers add",
            mcp_tool: "sendmock_number_upsert",
            selector: Some(OperationSelector::by_presence("number_id", false)),
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: VirtualNumberInput,
    ) -> Result<VirtualNumber, OperationError> {
        let new_number = build_virtual_number(operation_context, input, None).await?;
        operation_context
            .virtual_number_repository
            .insert_number(new_number.clone())
            .await?;
        Ok(VirtualNumber::from(new_number))
    }
}

pub struct UpdateVirtualNumberOperation;

impl Operation for UpdateVirtualNumberOperation {
    type Input = VirtualNumberUpdate;
    type Output = VirtualNumber;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchNumbersByNumberId",
            method: HttpMethod::Patch,
            path: "/api/v1/numbers/{numberId}",
            summary: "Change a number.",
            cli_usage: "sendmock numbers update <numberId>",
            mcp_tool: "sendmock_number_upsert",
            selector: Some(OperationSelector::by_presence("number_id", true)),
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Setting `messaging_service_sid` moves the number into that service's pool and out of
    /// any other.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: VirtualNumberUpdate,
    ) -> Result<VirtualNumber, OperationError> {
        let existing_number = operation_context
            .virtual_number_repository
            .find_number(&input.number_id)
            .await?
            .ok_or_else(|| OperationError::NotFound {
                message: format!("No number with id {}", input.number_id),
            })?;
        let changed_number =
            build_virtual_number(operation_context, input.changes, Some(existing_number)).await?;
        operation_context
            .virtual_number_repository
            .update_number(changed_number.clone())
            .await?;
        Ok(VirtualNumber::from(changed_number))
    }
}

pub struct DeleteVirtualNumberOperation;

impl Operation for DeleteVirtualNumberOperation {
    type Input = VirtualNumberReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteNumbersByNumberId",
            method: HttpMethod::Delete,
            path: "/api/v1/numbers/{numberId}",
            summary: "Delete a number.",
            is_destructive: true,
            cli_usage: "sendmock numbers remove <numberId>",
            mcp_tool: "sendmock_number_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Deleting a number that is already gone also succeeds, so retries are safe.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: VirtualNumberReference,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .virtual_number_repository
            .delete_number(&input.number_id)
            .await?;
        Ok(NoContent)
    }
}
