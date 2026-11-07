use super::messaging_service_builder::build_messaging_service;
use super::number_inputs::{
    MessagingServiceInput, MessagingServiceReference, MessagingServiceUpdate,
};
use super::number_views::MessagingService;
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

pub struct ListMessagingServicesOperation;

impl Operation for ListMessagingServicesOperation {
    type Input = NoInput;
    type Output = Vec<MessagingService>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getMessagingServices",
            method: HttpMethod::Get,
            path: "/api/v1/messaging-services",
            summary: "Messaging Services that pool numbers.",
            is_read_only: true,
            cli_usage: "sendmock sms services list",
            mcp_tool: "sendmock_messaging_service_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<MessagingService>, OperationError> {
        let stored_services = operation_context
            .messaging_service_repository
            .list_services()
            .await?;
        Ok(stored_services
            .into_iter()
            .map(MessagingService::from)
            .collect())
    }
}

pub struct CreateMessagingServiceOperation;

impl Operation for CreateMessagingServiceOperation {
    type Input = MessagingServiceInput;
    type Output = MessagingService;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postMessagingServices",
            method: HttpMethod::Post,
            path: "/api/v1/messaging-services",
            summary: "Add a Messaging Service.",
            cli_usage: "sendmock sms services create",
            mcp_tool: "sendmock_messaging_service_create",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Numbers put in the new pool leave the pool they were in.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: MessagingServiceInput,
    ) -> Result<MessagingService, OperationError> {
        let new_service = build_messaging_service(operation_context, input, None).await?;
        let stored_service = operation_context
            .messaging_service_repository
            .save_service(new_service)
            .await?;
        Ok(MessagingService::from(stored_service))
    }
}

pub struct UpdateMessagingServiceOperation;

impl Operation for UpdateMessagingServiceOperation {
    type Input = MessagingServiceUpdate;
    type Output = MessagingService;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchMessagingServicesByServiceSid",
            method: HttpMethod::Patch,
            path: "/api/v1/messaging-services/{serviceSid}",
            summary: "Change a Messaging Service.",
            cli_usage: "sendmock sms services update <serviceSid>",
            mcp_tool: "sendmock_messaging_service_update",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// The pool becomes exactly `number_ids`; numbers left out stay registered, outside any
    /// pool.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: MessagingServiceUpdate,
    ) -> Result<MessagingService, OperationError> {
        let existing_service = operation_context
            .messaging_service_repository
            .find_service(&input.service_sid)
            .await?
            .ok_or_else(|| OperationError::NotFound {
                message: format!("No Messaging Service with SID {}", input.service_sid),
            })?;
        let changed_service =
            build_messaging_service(operation_context, input.changes, Some(existing_service))
                .await?;
        let stored_service = operation_context
            .messaging_service_repository
            .save_service(changed_service)
            .await?;
        Ok(MessagingService::from(stored_service))
    }
}

pub struct DeleteMessagingServiceOperation;

impl Operation for DeleteMessagingServiceOperation {
    type Input = MessagingServiceReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteMessagingServicesByServiceSid",
            method: HttpMethod::Delete,
            path: "/api/v1/messaging-services/{serviceSid}",
            summary: "Delete a Messaging Service.",
            is_destructive: true,
            cli_usage: "sendmock sms services delete <serviceSid>",
            mcp_tool: "sendmock_messaging_service_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Its numbers stay registered, outside any pool; deleting a missing service succeeds.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: MessagingServiceReference,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .messaging_service_repository
            .delete_service(&input.service_sid)
            .await?;
        Ok(NoContent)
    }
}
