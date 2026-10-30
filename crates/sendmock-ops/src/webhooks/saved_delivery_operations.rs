use sendmock_store::{SavedWebhookDeliveryRecord, WebhookDeliveryRecord};

use super::delivery_detail::find_delivery_or_not_found;
use super::delivery_replay_operation::conflict;
use super::endpoint_view::read_request_settings;
use super::saved_delivery_inputs::{
    SavedDeliveryInput, SavedDeliveryReference, SavedDeliveryRename,
};
use super::saved_delivery_view::{SavedDelivery, build_saved_delivery_view};
use crate::{
    HttpMethod, NoContent, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

/// What a delivery whose endpoint is gone was rendered with, as far as anyone can tell.
const NATIVE_TEMPLATE_ID: &str = "native";

pub(super) async fn find_stored_saved_delivery(
    operation_context: &OperationContext,
    saved_id: &str,
) -> Result<SavedWebhookDeliveryRecord, OperationError> {
    operation_context
        .saved_webhook_delivery_repository
        .find_saved_delivery(saved_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No saved delivery with id {saved_id}"),
        })
}

fn read_saved_delivery_name(saved_delivery_name: &str) -> Result<String, OperationError> {
    let trimmed_name = saved_delivery_name.trim();
    if trimmed_name.is_empty() {
        return Err(OperationError::InvalidInput {
            message: "Enter a name".to_owned(),
            field: Some("name".to_owned()),
        });
    }
    Ok(trimmed_name.to_owned())
}

/// The template the delivery's endpoint uses now.
async fn find_endpoint_template_id(
    operation_context: &OperationContext,
    endpoint_id: &str,
) -> Result<String, OperationError> {
    let Some(stored_endpoint) = operation_context
        .webhook_endpoint_repository
        .find_endpoint(endpoint_id)
        .await?
    else {
        return Ok(NATIVE_TEMPLATE_ID.to_owned());
    };
    Ok(read_request_settings(&stored_endpoint)?.template_id)
}

/// A copy of the delivery's request before signing, with the event it carried.
async fn build_saved_record(
    operation_context: &OperationContext,
    source_delivery: WebhookDeliveryRecord,
    saved_name: String,
) -> Result<SavedWebhookDeliveryRecord, OperationError> {
    let Some(request_json) = source_delivery.rendered_request_json else {
        return Err(conflict(
            "nothing_to_save",
            "This delivery was never sent, so there is no request to save.".to_owned(),
        ));
    };
    Ok(SavedWebhookDeliveryRecord {
        saved_id: operation_context.id_generator.generate_id().to_string(),
        name: saved_name,
        template_id: find_endpoint_template_id(operation_context, &source_delivery.endpoint_id)
            .await?,
        endpoint_id: Some(source_delivery.endpoint_id),
        event_type: Some(source_delivery.event_type),
        event_json: source_delivery.event_json,
        request_json,
        saved_at_unix_ms: operation_context.clock.now_unix_ms(),
    })
}

pub struct ListSavedWebhookDeliveriesOperation;

impl Operation for ListSavedWebhookDeliveriesOperation {
    type Input = NoInput;
    type Output = Vec<SavedDelivery>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getWebhooksSaved",
            method: HttpMethod::Get,
            path: "/api/v1/webhooks/saved",
            summary: "Bookmarked requests, kept through pruning and reset.",
            is_read_only: true,
            cli_usage: "sendmock webhook saved list",
            mcp_tool: "sendmock_webhook_saved_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Newest first; the Saved screen searches them by name (WH-10.4).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<SavedDelivery>, OperationError> {
        operation_context
            .saved_webhook_delivery_repository
            .list_saved_deliveries()
            .await?
            .into_iter()
            .map(build_saved_delivery_view)
            .collect()
    }
}

pub struct CreateSavedWebhookDeliveryOperation;

impl Operation for CreateSavedWebhookDeliveryOperation {
    type Input = SavedDeliveryInput;
    type Output = SavedDelivery;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postWebhooksSaved",
            method: HttpMethod::Post,
            path: "/api/v1/webhooks/saved",
            summary: "Save a delivery's request under a name.",
            cli_usage: "sendmock webhook saved create --delivery <deliveryId>",
            mcp_tool: "sendmock_webhook_saved_create",
            cli_flag_names: &[("delivery_id", "delivery")],
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Saves any delivery, a composer send included, as a copy that pruning and `reset` leave
    /// alone (WH-10.1); a `render_failed` one has no request to save.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SavedDeliveryInput,
    ) -> Result<SavedDelivery, OperationError> {
        let source_delivery =
            find_delivery_or_not_found(operation_context, &input.delivery_id).await?;
        let saved_name = read_saved_delivery_name(&input.name)?;
        let new_saved_delivery =
            build_saved_record(operation_context, source_delivery, saved_name).await?;
        operation_context
            .saved_webhook_delivery_repository
            .insert_saved_delivery(new_saved_delivery.clone())
            .await?;
        build_saved_delivery_view(new_saved_delivery)
    }
}

pub struct RenameSavedWebhookDeliveryOperation;

impl Operation for RenameSavedWebhookDeliveryOperation {
    type Input = SavedDeliveryRename;
    type Output = SavedDelivery;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "patchWebhooksSavedBySavedId",
            method: HttpMethod::Patch,
            path: "/api/v1/webhooks/saved/{savedId}",
            summary: "Rename a saved delivery.",
            cli_usage: "sendmock webhook saved rename <savedId>",
            mcp_tool: "sendmock_webhook_saved_update",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SavedDeliveryRename,
    ) -> Result<SavedDelivery, OperationError> {
        let stored_saved_delivery =
            find_stored_saved_delivery(operation_context, &input.saved_id).await?;
        let new_name = read_saved_delivery_name(&input.name)?;
        operation_context
            .saved_webhook_delivery_repository
            .rename_saved_delivery(&input.saved_id, &new_name)
            .await?;
        build_saved_delivery_view(SavedWebhookDeliveryRecord {
            name: new_name,
            ..stored_saved_delivery
        })
    }
}

pub struct DeleteSavedWebhookDeliveryOperation;

impl Operation for DeleteSavedWebhookDeliveryOperation {
    type Input = SavedDeliveryReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteWebhooksSavedBySavedId",
            method: HttpMethod::Delete,
            path: "/api/v1/webhooks/saved/{savedId}",
            summary: "Delete a saved delivery.",
            is_destructive: true,
            cli_usage: "sendmock webhook saved delete <savedId>",
            mcp_tool: "sendmock_webhook_saved_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SavedDeliveryReference,
    ) -> Result<NoContent, OperationError> {
        let was_deleted = operation_context
            .saved_webhook_delivery_repository
            .delete_saved_delivery(&input.saved_id)
            .await?;
        if !was_deleted {
            return Err(OperationError::NotFound {
                message: format!("No saved delivery with id {}", input.saved_id),
            });
        }
        Ok(NoContent)
    }
}
