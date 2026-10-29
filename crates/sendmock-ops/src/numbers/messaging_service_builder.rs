use sendmock_store::MessagingServiceRecord;

use super::number_inputs::{MessagingServiceInboundMode, MessagingServiceInput};
use super::registry_fields::{CREATED_THROUGH_API, field_error, read_optional_url};
use crate::{OperationContext, OperationError};

/// The service as it will be stored: a name, a request URL when inbound messages go to a
/// webhook, http(s) URLs and registered numbers in the pool.
pub async fn build_messaging_service(
    operation_context: &OperationContext,
    input: MessagingServiceInput,
    existing_service: Option<MessagingServiceRecord>,
) -> Result<MessagingServiceRecord, OperationError> {
    let friendly_name = input.friendly_name.trim().to_owned();
    if friendly_name.is_empty() {
        return Err(field_error("friendly_name", "Enter a name"));
    }
    let inbound_url = read_optional_url("inbound_url", input.inbound_url)?;
    if input.inbound_mode == MessagingServiceInboundMode::Webhook && inbound_url.is_none() {
        return Err(field_error("inbound_url", "Enter the request URL"));
    }
    let number_ids = read_registered_pool(operation_context, input.number_ids).await?;
    let (service_sid, created_by, created_at_unix_ms) = match existing_service {
        Some(existing_service) => (
            existing_service.service_sid,
            existing_service.created_by,
            existing_service.created_at_unix_ms,
        ),
        None => (
            generate_service_sid(operation_context),
            CREATED_THROUGH_API.to_owned(),
            operation_context.clock.now_unix_ms(),
        ),
    };
    Ok(MessagingServiceRecord {
        service_sid,
        friendly_name,
        number_ids,
        inbound_mode: input.inbound_mode.as_str().to_owned(),
        inbound_url,
        inbound_fallback_url: read_optional_url(
            "inbound_fallback_url",
            input.inbound_fallback_url,
        )?,
        created_by,
        created_at_unix_ms,
    })
}

async fn read_registered_pool(
    operation_context: &OperationContext,
    number_ids: Vec<String>,
) -> Result<Vec<String>, OperationError> {
    let mut pool_number_ids: Vec<String> = Vec::new();
    for number_id in number_ids {
        let stored_number = operation_context
            .virtual_number_repository
            .find_number(&number_id)
            .await?;
        if stored_number.is_none() {
            return Err(field_error(
                "number_ids",
                &format!("No number with id {number_id}"),
            ));
        }
        if !pool_number_ids.contains(&number_id) {
            pool_number_ids.push(number_id);
        }
    }
    Ok(pool_number_ids)
}

/// `MG` and 32 hex digits, as Twilio writes service SIDs.
fn generate_service_sid(operation_context: &OperationContext) -> String {
    let random_source = &operation_context.random_source;
    format!(
        "MG{:016x}{:016x}",
        random_source.next_u64(),
        random_source.next_u64()
    )
}
