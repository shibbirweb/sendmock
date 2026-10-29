use sendmock_store::WebhookEndpointRecord;
use sendmock_webhooks::WebhookSecret;

use super::endpoint_inputs::{
    WebhookEndpointInput, WebhookEndpointReference, WebhookEndpointUpdate,
};
use super::endpoint_validation::validate_endpoint_input;
use super::endpoint_view::{
    WebhookEndpoint, build_endpoint_view, read_request_settings, write_request_settings,
};
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

/// The REST API cannot tell the UI, CLI and agents apart yet.
const CREATED_THROUGH_API: &str = "api";

pub(super) async fn find_stored_endpoint(
    operation_context: &OperationContext,
    endpoint_id: &str,
) -> Result<WebhookEndpointRecord, OperationError> {
    operation_context
        .webhook_endpoint_repository
        .find_endpoint(endpoint_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No webhook endpoint with id {endpoint_id}"),
        })
}

pub struct ListWebhookEndpointsOperation;

impl Operation for ListWebhookEndpointsOperation {
    type Input = NoInput;
    type Output = Vec<WebhookEndpoint>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getWebhooksEndpoints",
            method: HttpMethod::Get,
            path: "/api/v1/webhooks/endpoints",
            summary: "Where webhooks go: URL, template, secret and retry policy.",
            is_read_only: true,
            cli_usage: "sendmock webhook endpoint list",
            mcp_tool: "sendmock_webhook_endpoint_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<WebhookEndpoint>, OperationError> {
        let now_unix_ms = operation_context.clock.now_unix_ms();
        operation_context
            .webhook_endpoint_repository
            .list_endpoints()
            .await?
            .into_iter()
            .map(|stored_endpoint| build_endpoint_view(stored_endpoint, now_unix_ms))
            .collect()
    }
}

pub struct CreateWebhookEndpointOperation;

impl Operation for CreateWebhookEndpointOperation {
    type Input = WebhookEndpointInput;
    type Output = WebhookEndpoint;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postWebhooksEndpoints",
            method: HttpMethod::Post,
            path: "/api/v1/webhooks/endpoints",
            summary: "Add an endpoint; its signing secret is generated.",
            cli_usage: "sendmock webhook endpoint create",
            mcp_tool: "sendmock_webhook_endpoint_create",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookEndpointInput,
    ) -> Result<WebhookEndpoint, OperationError> {
        validate_endpoint_input(&input)?;
        let now_unix_ms = operation_context.clock.now_unix_ms();
        let new_endpoint = WebhookEndpointRecord {
            endpoint_id: operation_context.id_generator.generate_id().to_string(),
            name: input.name.trim().to_owned(),
            url: input.url.trim().to_owned(),
            is_enabled: input.is_enabled,
            request_settings_json: write_request_settings(&input.request_settings)?,
            signing_secret: WebhookSecret::generate(operation_context.random_source.as_ref())
                .expose()
                .to_owned(),
            previous_signing_secret: None,
            previous_secret_expires_at_unix_ms: None,
            created_by: CREATED_THROUGH_API.to_owned(),
            created_at_unix_ms: now_unix_ms,
        };
        operation_context
            .webhook_endpoint_repository
            .insert_endpoint(new_endpoint.clone())
            .await?;
        build_endpoint_view(new_endpoint, now_unix_ms)
    }
}

pub struct GetWebhookEndpointOperation;

impl Operation for GetWebhookEndpointOperation {
    type Input = WebhookEndpointReference;
    type Output = WebhookEndpoint;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getWebhooksEndpointsByEndpointId",
            method: HttpMethod::Get,
            path: "/api/v1/webhooks/endpoints/{endpointId}",
            summary: "One endpoint; its secret masked.",
            is_read_only: true,
            cli_usage: "sendmock webhook endpoint show <endpointId>",
            mcp_tool: "sendmock_webhook_endpoint_get",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookEndpointReference,
    ) -> Result<WebhookEndpoint, OperationError> {
        let stored_endpoint = find_stored_endpoint(operation_context, &input.endpoint_id).await?;
        build_endpoint_view(stored_endpoint, operation_context.clock.now_unix_ms())
    }
}

pub struct UpdateWebhookEndpointOperation;

impl Operation for UpdateWebhookEndpointOperation {
    type Input = WebhookEndpointUpdate;
    type Output = WebhookEndpoint;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchWebhooksEndpointsByEndpointId",
            method: HttpMethod::Patch,
            path: "/api/v1/webhooks/endpoints/{endpointId}",
            summary: "Change an endpoint; send only the changed keys.",
            cli_usage: "sendmock webhook endpoint update <endpointId>",
            mcp_tool: "sendmock_webhook_endpoint_update",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// The changed endpoint is checked as a whole with the create rules before it is saved.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookEndpointUpdate,
    ) -> Result<WebhookEndpoint, OperationError> {
        let stored_endpoint = find_stored_endpoint(operation_context, &input.endpoint_id).await?;
        let changed_input = WebhookEndpointInput {
            name: input.name.clone().unwrap_or(stored_endpoint.name.clone()),
            url: input.url.clone().unwrap_or(stored_endpoint.url.clone()),
            is_enabled: input.is_enabled.unwrap_or(stored_endpoint.is_enabled),
            request_settings: input.apply_to_settings(read_request_settings(&stored_endpoint)?),
        };
        validate_endpoint_input(&changed_input)?;
        let changed_endpoint = WebhookEndpointRecord {
            name: changed_input.name.trim().to_owned(),
            url: changed_input.url.trim().to_owned(),
            is_enabled: changed_input.is_enabled,
            request_settings_json: write_request_settings(&changed_input.request_settings)?,
            ..stored_endpoint
        };
        operation_context
            .webhook_endpoint_repository
            .update_endpoint(changed_endpoint.clone())
            .await?;
        build_endpoint_view(changed_endpoint, operation_context.clock.now_unix_ms())
    }
}

pub struct DeleteWebhookEndpointOperation;

impl Operation for DeleteWebhookEndpointOperation {
    type Input = WebhookEndpointReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteWebhooksEndpointsByEndpointId",
            method: HttpMethod::Delete,
            path: "/api/v1/webhooks/endpoints/{endpointId}",
            summary: "Delete an endpoint and its rules.",
            is_destructive: true,
            cli_usage: "sendmock webhook endpoint delete <endpointId>",
            mcp_tool: "sendmock_webhook_endpoint_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookEndpointReference,
    ) -> Result<NoContent, OperationError> {
        let was_deleted = operation_context
            .webhook_endpoint_repository
            .delete_endpoint(&input.endpoint_id)
            .await?;
        if !was_deleted {
            return Err(OperationError::NotFound {
                message: format!("No webhook endpoint with id {}", input.endpoint_id),
            });
        }
        Ok(NoContent)
    }
}
