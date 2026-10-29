use std::time::Duration;

use sendmock_core::format_rfc3339;
use sendmock_sms::PhoneNumber;
use sendmock_store::{SmsListFilter, SmsRecord};

use crate::{OperationContext, OperationError};

/// Recent messages to a number looked through for one with a code.
const RECENT_MESSAGES_SEARCHED: u32 = 20;
const WAIT_POLL_INTERVAL: Duration = Duration::from_millis(200);

/// The newest SMS to `recipient` with a code; waits up to `wait_duration` for one, and
/// answers at once when it is zero.
pub async fn find_newest_sms_with_code(
    operation_context: &OperationContext,
    recipient: &str,
    wait_duration: Duration,
) -> Result<Option<SmsRecord>, OperationError> {
    let wait_deadline = tokio::time::Instant::now() + wait_duration;
    let filter = SmsListFilter {
        to_number: Some(PhoneNumber::parse(recipient).normalized().to_owned()),
        ..SmsListFilter::default()
    };
    loop {
        let page = operation_context
            .sms_repository
            .list_messages(filter.clone(), None, RECENT_MESSAGES_SEARCHED)
            .await?;
        if let Some(sms_with_code) = page
            .messages
            .into_iter()
            .find(|sms| !sms.otp_codes.is_empty())
        {
            return Ok(Some(sms_with_code));
        }
        if tokio::time::Instant::now() >= wait_deadline {
            return Ok(None);
        }
        tokio::time::sleep(WAIT_POLL_INTERVAL).await;
    }
}

/// The code, the message id and when it arrived, for `GET /otp?channel=sms`.
pub fn describe_sms_code(sms: &SmsRecord) -> (String, String, String) {
    (
        sms.otp_codes.first().cloned().unwrap_or_default(),
        sms.sms_id.clone(),
        format_rfc3339(sms.created_at_unix_ms),
    )
}
