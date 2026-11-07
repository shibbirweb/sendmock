use sendmock_store::{DeliveryOutcomeFilter, DeliveryOutcomeRecord};
use sendmock_webhooks::{DeliverySample, MeteredEndpoint};

use crate::{OperationContext, OperationError};

/// The attempts the filter takes from the delivery log, oldest first.
pub async fn load_delivery_samples(
    operation_context: &OperationContext,
    filter: DeliveryOutcomeFilter,
) -> Result<Vec<DeliverySample>, OperationError> {
    let outcome_records = operation_context
        .webhook_delivery_repository
        .list_delivery_outcomes(filter)
        .await?;
    Ok(outcome_records
        .into_iter()
        .map(build_delivery_sample)
        .collect())
}

fn build_delivery_sample(outcome_record: DeliveryOutcomeRecord) -> DeliverySample {
    DeliverySample {
        delivery_id: outcome_record.delivery_id,
        endpoint_id: outcome_record.endpoint_id,
        endpoint_name: outcome_record.endpoint_name,
        event_type: outcome_record.event_type,
        attempt: outcome_record.attempt,
        status: outcome_record.status,
        response_status_code: outcome_record.response_status_code,
        duration_ms: outcome_record.duration_ms,
        error_message: outcome_record.error_message,
        has_retry_due: outcome_record.has_retry_due,
        created_at_unix_ms: outcome_record.created_at_unix_ms,
    }
}

/// Every endpoint, or only `endpoint_id` when it is given (none when it is unknown).
pub async fn load_metered_endpoints(
    operation_context: &OperationContext,
    endpoint_id: Option<&str>,
) -> Result<Vec<MeteredEndpoint>, OperationError> {
    let stored_endpoints = operation_context
        .webhook_endpoint_repository
        .list_endpoints()
        .await?;
    Ok(stored_endpoints
        .into_iter()
        .filter(|stored_endpoint| {
            endpoint_id.is_none_or(|endpoint_id| stored_endpoint.endpoint_id == endpoint_id)
        })
        .map(|stored_endpoint| MeteredEndpoint {
            endpoint_id: stored_endpoint.endpoint_id,
            endpoint_name: stored_endpoint.name,
        })
        .collect())
}
