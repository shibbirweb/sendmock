use schemars::JsonSchema;
use sendmock_store::WebhookSecretRotation;
use sendmock_webhooks::WebhookSecret;
use serde::Serialize;

use super::endpoint_inputs::{RotateSecretRequest, WebhookEndpointReference};
use super::endpoint_operations::find_stored_endpoint;
use super::endpoint_validation::ALLOWED_OVERLAP_HOURS;
use super::endpoint_view::{WebhookEndpoint, build_endpoint_view};
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

const HOUR_MS: i64 = 3_600_000;

/// `GET /api/v1/webhooks/endpoints/{endpointId}/secret` (WH-01.3).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct RevealedEndpointSecret {
    pub secret: String,
}

pub struct RevealWebhookEndpointSecretOperation;

impl Operation for RevealWebhookEndpointSecretOperation {
    type Input = WebhookEndpointReference;
    type Output = RevealedEndpointSecret;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getWebhooksEndpointsByEndpointIdSecret",
            method: HttpMethod::Get,
            path: "/api/v1/webhooks/endpoints/{endpointId}/secret",
            summary: "Reveal the signing secret (asked for after a confirmation).",
            is_read_only: true,
            cli_usage: "sendmock webhook endpoint secret <endpointId> --reveal",
            revealed_secret_field: Some("secret"),
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookEndpointReference,
    ) -> Result<RevealedEndpointSecret, OperationError> {
        let stored_endpoint = find_stored_endpoint(operation_context, &input.endpoint_id).await?;
        Ok(RevealedEndpointSecret {
            secret: stored_endpoint.signing_secret,
        })
    }
}

pub struct RotateWebhookEndpointSecretOperation;

impl Operation for RotateWebhookEndpointSecretOperation {
    type Input = RotateSecretRequest;
    type Output = WebhookEndpoint;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postWebhooksEndpointsByEndpointIdRotateSecret",
            method: HttpMethod::Post,
            path: "/api/v1/webhooks/endpoints/{endpointId}/rotate-secret",
            summary: "New signing secret; the old one keeps working for the overlap.",
            cli_usage: "sendmock webhook endpoint rotate-secret <endpointId>",
            mcp_tool: "sendmock_webhook_endpoint_rotate_secret",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// The current secret keeps signing next to the new one for `overlap_hours` (WH-01.8).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: RotateSecretRequest,
    ) -> Result<WebhookEndpoint, OperationError> {
        if !ALLOWED_OVERLAP_HOURS.contains(&input.overlap_hours) {
            return Err(OperationError::InvalidInput {
                message: "Overlap must be 1, 24 or 168 hours".to_owned(),
                field: Some("overlap_hours".to_owned()),
            });
        }
        find_stored_endpoint(operation_context, &input.endpoint_id).await?;
        let now_unix_ms = operation_context.clock.now_unix_ms();
        let new_secret = WebhookSecret::generate(operation_context.random_source.as_ref());
        operation_context
            .webhook_endpoint_repository
            .rotate_signing_secret(
                &input.endpoint_id,
                WebhookSecretRotation {
                    new_signing_secret: new_secret.expose().to_owned(),
                    previous_secret_expires_at_unix_ms: now_unix_ms
                        + i64::from(input.overlap_hours) * HOUR_MS,
                },
            )
            .await?;
        let rotated_endpoint = find_stored_endpoint(operation_context, &input.endpoint_id).await?;
        build_endpoint_view(rotated_endpoint, now_unix_ms)
    }
}
