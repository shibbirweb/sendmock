use sendmock_sms::TwimlMethod;

use crate::{OperationContext, OperationError};

/// Who configured the URL an inbound message is sent to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ReplyWebhookTargetKind {
    /// A Messaging Service set to "Send a webhook".
    MessagingService,
    /// The number's own "A message comes in" URL.
    Number,
}

/// Where an inbound message's reply webhook goes and how it is sent.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReplyWebhookTarget {
    pub kind: ReplyWebhookTargetKind,
    pub url: String,
    pub method: TwimlMethod,
    pub fallback_url: Option<String>,
    /// The number's Messaging Service, sent as `MessagingServiceSid`.
    pub messaging_service_sid: Option<String>,
    /// The number's payload template; `None` sends Twilio's inbound format.
    pub template_id: Option<String>,
}

/// The reply webhook for a message to `app_number`, first match wins: the number's Messaging
/// Service when it sends a webhook (always `POST`, as a service has no method setting), else the
/// number's own URL (also when the service defers to it), else none. A service set to drop
/// inbound messages sends nothing.
pub async fn resolve_reply_webhook_target(
    operation_context: &OperationContext,
    app_number: &str,
) -> Result<Option<ReplyWebhookTarget>, OperationError> {
    let Some(virtual_number) = operation_context
        .virtual_number_repository
        .find_by_number(app_number)
        .await?
    else {
        return Ok(None);
    };
    let messaging_service = match virtual_number.messaging_service_sid.as_deref() {
        Some(service_sid) => {
            operation_context
                .messaging_service_repository
                .find_service(service_sid)
                .await?
        }
        None => None,
    };
    let number_target = |url: String| ReplyWebhookTarget {
        kind: ReplyWebhookTargetKind::Number,
        url,
        method: TwimlMethod::from_attribute(Some(&virtual_number.inbound_method)),
        fallback_url: virtual_number.inbound_fallback_url.clone(),
        messaging_service_sid: virtual_number.messaging_service_sid.clone(),
        template_id: virtual_number.inbound_template_id.clone(),
    };
    match messaging_service {
        Some(service) if service.inbound_mode == "drop" => Ok(None),
        Some(service) if service.inbound_mode == "webhook" && service.inbound_url.is_some() => {
            Ok(Some(ReplyWebhookTarget {
                kind: ReplyWebhookTargetKind::MessagingService,
                url: service.inbound_url.unwrap_or_default(),
                method: TwimlMethod::Post,
                fallback_url: service.inbound_fallback_url,
                messaging_service_sid: Some(service.service_sid),
                template_id: virtual_number.inbound_template_id.clone(),
            }))
        }
        _ => Ok(virtual_number.inbound_url.clone().map(number_target)),
    }
}
