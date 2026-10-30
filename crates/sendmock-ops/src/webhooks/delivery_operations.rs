use sendmock_store::WebhookDeliveryFilter;

use super::delivery_detail::{
    WebhookDeliveryDetail, find_delivery_or_not_found, load_delivery_detail,
};
use super::delivery_inputs::{DeliveryListInput, DeliveryReference};
use super::delivery_view::WebhookDelivery;
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError, PageOf};

const DEFAULT_PAGE_SIZE: u32 = 50;
const MAXIMUM_PAGE_SIZE: u32 = 200;

/// A comma-separated status list; `failed` also finds `exhausted`, as the log's Failed tab does.
pub fn read_status_list(status_text: Option<&str>) -> Vec<String> {
    status_text
        .into_iter()
        .flat_map(|status_text| status_text.split(','))
        .map(str::trim)
        .filter(|status| !status.is_empty())
        .flat_map(|status| match status {
            "failed" => vec!["failed".to_owned(), "exhausted".to_owned()],
            other_status => vec![other_status.to_owned()],
        })
        .collect()
}

pub struct ListWebhookDeliveriesOperation;

impl Operation for ListWebhookDeliveriesOperation {
    type Input = DeliveryListInput;
    type Output = PageOf<WebhookDelivery>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getWebhooksDeliveries",
            method: HttpMethod::Get,
            path: "/api/v1/webhooks/deliveries",
            summary: "Every webhook request sent, newest first.",
            is_read_only: true,
            cli_usage: "sendmock webhook deliveries list",
            mcp_tool: "sendmock_webhook_delivery_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: DeliveryListInput,
    ) -> Result<PageOf<WebhookDelivery>, OperationError> {
        let filter = WebhookDeliveryFilter {
            statuses: read_status_list(input.status.as_deref()),
            endpoint_id: input.endpoint_id,
            event_type: input.event_type,
            created_after_unix_ms: None,
        };
        let page_size = input
            .limit
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAXIMUM_PAGE_SIZE);
        let page = operation_context
            .webhook_delivery_repository
            .list_deliveries(filter, input.cursor, page_size)
            .await?;
        Ok(PageOf {
            items: page
                .deliveries
                .into_iter()
                .map(WebhookDelivery::from)
                .collect(),
            next_cursor: page.next_cursor,
            total_count: page.total_count,
        })
    }
}

pub struct GetWebhookDeliveryOperation;

impl Operation for GetWebhookDeliveryOperation {
    type Input = DeliveryReference;
    type Output = WebhookDeliveryDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getWebhooksDeliveriesByDeliveryId",
            method: HttpMethod::Get,
            path: "/api/v1/webhooks/deliveries/{deliveryId}",
            summary: "One delivery: request, response and every attempt.",
            is_read_only: true,
            cli_usage: "sendmock webhook deliveries show <deliveryId>",
            mcp_tool: "sendmock_webhook_delivery_get",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: DeliveryReference,
    ) -> Result<WebhookDeliveryDetail, OperationError> {
        let stored_delivery =
            find_delivery_or_not_found(operation_context, &input.delivery_id).await?;
        load_delivery_detail(operation_context, stored_delivery).await
    }
}

pub struct CancelWebhookDeliveryOperation;

impl Operation for CancelWebhookDeliveryOperation {
    type Input = DeliveryReference;
    type Output = WebhookDeliveryDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postWebhooksDeliveriesByDeliveryIdCancel",
            method: HttpMethod::Post,
            path: "/api/v1/webhooks/deliveries/{deliveryId}/cancel",
            summary: "Stop the remaining retries.",
            cli_usage: "sendmock webhook deliveries cancel <deliveryId>",
            mcp_tool: "sendmock_webhook_delivery_cancel",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Cancels the event's latest attempt when it is still waiting to run (WH-03.9); any
    /// attempt of the event can be named.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: DeliveryReference,
    ) -> Result<WebhookDeliveryDetail, OperationError> {
        let named_delivery =
            find_delivery_or_not_found(operation_context, &input.delivery_id).await?;
        let latest_attempt = operation_context
            .webhook_delivery_repository
            .list_event_attempts(&named_delivery.event_id, &named_delivery.endpoint_id)
            .await?
            .pop()
            .unwrap_or(named_delivery);
        let was_cancelled = operation_context
            .webhook_delivery_repository
            .cancel_delivery(&latest_attempt.delivery_id)
            .await?;
        if !was_cancelled {
            return Err(OperationError::Conflict {
                code: "not_retrying",
                message: format!(
                    "Delivery {} has no retry left to cancel",
                    latest_attempt.delivery_id
                ),
            });
        }
        let cancelled_delivery =
            find_delivery_or_not_found(operation_context, &latest_attempt.delivery_id).await?;
        load_delivery_detail(operation_context, cancelled_delivery).await
    }
}
