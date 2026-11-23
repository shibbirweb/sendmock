//! What a template reads as `data` for an event: the stored email in full for `email.*`
//! events, the message with its numbers' countries for `sms.*`, the event's own data otherwise.

use serde_json::Value;

use super::email_template_data::read_email_event_data;
use crate::sms::add_number_countries;
use crate::{OperationContext, OperationError};

/// An event's template data, and whether it is a stored email (templates also read it as
/// `email` then).
pub struct EventTemplateData {
    pub data: Value,
    pub is_stored_email: bool,
}

pub async fn read_event_template_data(
    operation_context: &OperationContext,
    event_type: &str,
    event_data: &Value,
) -> Result<EventTemplateData, OperationError> {
    if let Some(email_data) =
        read_email_event_data(operation_context, event_type, event_data).await?
    {
        return Ok(EventTemplateData {
            data: email_data,
            is_stored_email: true,
        });
    }
    let mut data = event_data.clone();
    if event_type.starts_with("sms.") {
        add_number_countries(&mut data);
    }
    Ok(EventTemplateData {
        data,
        is_stored_email: false,
    })
}
