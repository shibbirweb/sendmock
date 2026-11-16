use sendmock_store::{DeliveryDeleteOutcome, WebhookDeliveryFilter};

use super::delivery_inputs::{DeliveryFilterQuery, DeliveryReference};
use super::delivery_operations::read_status_list;
use crate::events::publish_traffic_cleared;
use crate::{
    HttpMethod, NoContent, Operation, OperationContext, OperationDefinition, OperationError,
    SuccessStatus,
};

pub struct DeleteWebhookDeliveryOperation;

impl Operation for DeleteWebhookDeliveryOperation {
    type Input = DeliveryReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteWebhooksDeliveriesByDeliveryId",
            method: HttpMethod::Delete,
            path: "/api/v1/webhooks/deliveries/{deliveryId}",
            summary: "Delete a finished delivery; 409 while it is queued or waiting for a retry.",
            is_destructive: true,
            cli_usage: "sendmock webhook deliveries delete <deliveryId>",
            mcp_tool: "sendmock_webhook_delivery_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Deleting a delivery that is already gone also succeeds, so retries are safe.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: DeliveryReference,
    ) -> Result<NoContent, OperationError> {
        let delete_outcome = operation_context
            .webhook_delivery_repository
            .delete_finished_delivery(&input.delivery_id)
            .await?;
        if delete_outcome == DeliveryDeleteOutcome::InFlight {
            return Err(OperationError::Conflict {
                code: "delivery_in_flight",
                message: "This delivery is queued or waiting for a retry; cancel it first"
                    .to_owned(),
            });
        }
        Ok(NoContent)
    }
}

pub struct DeleteWebhookDeliveriesOperation;

impl Operation for DeleteWebhookDeliveriesOperation {
    type Input = DeliveryFilterQuery;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteWebhooksDeliveries",
            method: HttpMethod::Delete,
            path: "/api/v1/webhooks/deliveries",
            summary: "Delete every finished delivery, or those the filters match; queued and retrying ones stay.",
            is_destructive: true,
            cli_usage: "sendmock webhook deliveries delete-all --yes",
            mcp_tool: "sendmock_webhook_delivery_delete_all",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: DeliveryFilterQuery,
    ) -> Result<NoContent, OperationError> {
        let deleted_count = operation_context
            .webhook_delivery_repository
            .delete_finished_deliveries(WebhookDeliveryFilter {
                statuses: read_status_list(input.status.as_deref()),
                endpoint_id: input.endpoint_id,
                event_type: input.event_type,
                subject_id: input.subject_id,
                ..WebhookDeliveryFilter::default()
            })
            .await?;
        publish_traffic_cleared(
            operation_context,
            &["webhook_delivery"],
            None,
            deleted_count,
        );
        Ok(NoContent)
    }
}
