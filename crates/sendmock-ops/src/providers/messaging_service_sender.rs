use sendmock_store::MessagingServiceRecord;

use super::request_checks::ProviderFailure;
use crate::numbers::generate_service_sid;
use crate::{OperationContext, OperationError};

/// Twilio's valid test sender, used when a service's pool is empty so the send still works.
const GENERATED_SENDER: &str = "+15005550006";
/// Twilio's code for a Messaging Service SID it does not know.
const UNKNOWN_SERVICE_ERROR_CODE: &str = "21701";
const WHATSAPP_PREFIX: &str = "whatsapp:";

/// The sender for a send with `MessagingServiceSid` and no `From`: a number from the service's
/// pool that works on the recipient's channel, or Twilio's test sender when there is none. An
/// unknown service is created in lenient mode and refused with `21701` in strict test mode.
pub async fn pick_pool_sender(
    operation_context: &OperationContext,
    service_sid: &str,
    to_number: &str,
) -> Result<Result<String, ProviderFailure>, OperationError> {
    let messaging_service = match operation_context
        .messaging_service_repository
        .find_service(service_sid)
        .await?
    {
        Some(messaging_service) => messaging_service,
        None => {
            let app_settings = operation_context.settings_store.current().await?;
            if app_settings.is_strict_twilio_test_mode {
                return Ok(Err(unknown_service_failure(service_sid)));
            }
            create_lenient_service(operation_context, service_sid).await?
        }
    };
    let is_whatsapp = to_number.starts_with(WHATSAPP_PREFIX);
    let wanted_channel = if is_whatsapp { "whatsapp" } else { "sms" };
    let mut pool_numbers = Vec::new();
    for number_id in &messaging_service.number_ids {
        if let Some(pool_number) = operation_context
            .virtual_number_repository
            .find_number(number_id)
            .await?
            .filter(|pool_number| {
                pool_number
                    .channels
                    .iter()
                    .any(|channel| channel == wanted_channel)
            })
        {
            pool_numbers.push(pool_number.number);
        }
    }
    let sender = if pool_numbers.is_empty() {
        GENERATED_SENDER.to_owned()
    } else {
        let picked_index = operation_context.random_source.next_u64() as usize % pool_numbers.len();
        pool_numbers.swap_remove(picked_index)
    };
    Ok(Ok(if is_whatsapp {
        format!("{WHATSAPP_PREFIX}{sender}")
    } else {
        sender
    }))
}

fn unknown_service_failure(service_sid: &str) -> ProviderFailure {
    ProviderFailure {
        code: Some(UNKNOWN_SERVICE_ERROR_CODE.to_owned()),
        provider_message: Some(format!(
            "The Messaging Service Sid {service_sid} is invalid."
        )),
        ..ProviderFailure::new(
            "invalid_value",
            "messaging_service",
            format!("Unknown Messaging Service {service_sid}"),
        )
    }
}

/// A service with the SID the app sent, so a send with any SID just works.
async fn create_lenient_service(
    operation_context: &OperationContext,
    service_sid: &str,
) -> Result<MessagingServiceRecord, OperationError> {
    let service_sid = if service_sid.starts_with("MG") {
        service_sid.to_owned()
    } else {
        generate_service_sid(operation_context)
    };
    Ok(operation_context
        .messaging_service_repository
        .save_service(MessagingServiceRecord {
            friendly_name: format!("Created for {service_sid}"),
            service_sid,
            number_ids: Vec::new(),
            inbound_mode: "defer_to_sender".to_owned(),
            inbound_url: None,
            inbound_fallback_url: None,
            created_by: "api".to_owned(),
            created_at_unix_ms: operation_context.clock.now_unix_ms(),
        })
        .await?)
}
