use sendmock_sms::{PhoneNumber, split_channel_prefix};

use crate::providers::MessageProviderDefinition;
use crate::{OperationContext, OperationError};

/// Whether a send through this provider is refused with 21610: the provider emulates opt-outs
/// and the recipient texted STOP to the sending number, to its Messaging Service, or to the
/// Messaging Service the send names.
pub async fn is_send_opted_out(
    operation_context: &OperationContext,
    provider: &MessageProviderDefinition,
    from_number: &str,
    messaging_service_sid: Option<&str>,
    to_number: &str,
) -> Result<bool, OperationError> {
    if !provider.has_opt_out_keywords() {
        return Ok(false);
    }
    let (from_number, to_number) = (normalize_number(from_number), normalize_number(to_number));
    let from_number = from_number.as_str();
    let mut senders = vec![from_number.to_owned()];
    senders.extend(messaging_service_sid.map(str::to_owned));
    let sending_number = operation_context
        .virtual_number_repository
        .find_by_number(from_number)
        .await?;
    senders.extend(
        sending_number.and_then(|registered_number| registered_number.messaging_service_sid),
    );
    Ok(operation_context
        .sms_delivery_stores
        .opt_outs
        .is_opted_out(senders, &to_number)
        .await?)
}

/// E.164 without a channel prefix, as numbers are stored.
fn normalize_number(address: &str) -> String {
    let (_, number) = split_channel_prefix(address);
    PhoneNumber::parse(number).normalized().to_owned()
}
