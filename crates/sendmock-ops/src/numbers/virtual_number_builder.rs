use sendmock_store::VirtualNumberRecord;

use super::number_inputs::{NumberChannel, VirtualNumberInput};
use super::registry_fields::{
    CREATED_THROUGH_API, field_error, is_e164, read_optional_text, read_optional_url,
};
use crate::{OperationContext, OperationError};

/// The number as it will be stored, checked as the form checks it: E.164, not registered by
/// another number, a label, a channel, http(s) URLs and an existing Messaging Service.
pub async fn build_virtual_number(
    operation_context: &OperationContext,
    input: VirtualNumberInput,
    existing_number: Option<VirtualNumberRecord>,
) -> Result<VirtualNumberRecord, OperationError> {
    let editing_number_id = existing_number
        .as_ref()
        .map(|number| number.number_id.clone());
    let e164_number =
        read_unregistered_number(operation_context, &input.number, editing_number_id).await?;
    let label = input.label.trim().to_owned();
    if label.is_empty() {
        return Err(field_error("label", "Enter a label"));
    }
    let channels = read_channels(&input.channels)?;
    let messaging_service_sid =
        read_existing_service_sid(operation_context, input.messaging_service_sid).await?;
    Ok(VirtualNumberRecord {
        number: e164_number,
        label,
        channels,
        inbound_url: read_optional_url("inbound_url", input.inbound_url)?,
        inbound_method: input.inbound_method.as_str().to_owned(),
        inbound_fallback_url: read_optional_url(
            "inbound_fallback_url",
            input.inbound_fallback_url,
        )?,
        inbound_template_id: read_optional_text(input.inbound_template_id),
        status_callback_url: read_optional_url("status_callback_url", input.status_callback_url)?,
        messaging_service_sid,
        ..existing_number.unwrap_or_else(|| new_number_record(operation_context))
    })
}

async fn read_unregistered_number(
    operation_context: &OperationContext,
    number_text: &str,
    editing_number_id: Option<String>,
) -> Result<String, OperationError> {
    let e164_number = number_text.trim().to_owned();
    if !is_e164(&e164_number) {
        return Err(field_error("number", "Use E.164, for example +15550001111"));
    }
    let registered_number = operation_context
        .virtual_number_repository
        .find_by_number(&e164_number)
        .await?;
    if registered_number.is_some_and(|registered| Some(registered.number_id) != editing_number_id) {
        return Err(field_error("number", "This number is already registered"));
    }
    Ok(e164_number)
}

fn read_channels(channels: &[NumberChannel]) -> Result<Vec<String>, OperationError> {
    let mut distinct_channels: Vec<String> = Vec::new();
    for channel in channels {
        if !distinct_channels
            .iter()
            .any(|kept_channel| kept_channel == channel.as_str())
        {
            distinct_channels.push(channel.as_str().to_owned());
        }
    }
    if distinct_channels.is_empty() {
        return Err(field_error("channels", "Pick at least one channel"));
    }
    Ok(distinct_channels)
}

async fn read_existing_service_sid(
    operation_context: &OperationContext,
    service_sid: Option<String>,
) -> Result<Option<String>, OperationError> {
    let Some(service_sid) = read_optional_text(service_sid) else {
        return Ok(None);
    };
    let stored_service = operation_context
        .messaging_service_repository
        .find_service(&service_sid)
        .await?;
    match stored_service {
        Some(_) => Ok(Some(service_sid)),
        None => Err(field_error(
            "messaging_service_sid",
            "Pick an existing Messaging Service",
        )),
    }
}

fn new_number_record(operation_context: &OperationContext) -> VirtualNumberRecord {
    VirtualNumberRecord {
        number_id: operation_context.id_generator.generate_id().to_string(),
        number: String::new(),
        label: String::new(),
        channels: Vec::new(),
        inbound_url: None,
        inbound_method: String::new(),
        inbound_fallback_url: None,
        inbound_template_id: None,
        status_callback_url: None,
        messaging_service_sid: None,
        created_by: CREATED_THROUGH_API.to_owned(),
        created_at_unix_ms: operation_context.clock.now_unix_ms(),
    }
}
