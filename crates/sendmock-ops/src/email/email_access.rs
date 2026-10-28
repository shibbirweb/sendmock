use std::time::Duration;

use sendmock_store::{EmailListFilter, EmailRecord};

use crate::{OperationContext, OperationError};

/// How often a wait looks for a new match.
const WAIT_POLL_INTERVAL: Duration = Duration::from_millis(200);

pub async fn find_email_or_not_found(
    operation_context: &OperationContext,
    email_id: &str,
) -> Result<EmailRecord, OperationError> {
    operation_context
        .email_repository
        .find_email(email_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No email with id {email_id}"),
        })
}

/// The newest email matching the filter, looking again until one arrives or the wait ends.
pub async fn wait_for_newest_email(
    operation_context: &OperationContext,
    filter: EmailListFilter,
    wait_duration: Duration,
) -> Result<Option<EmailRecord>, OperationError> {
    let wait_deadline = tokio::time::Instant::now() + wait_duration;
    loop {
        let page = operation_context
            .email_repository
            .list_emails(filter.clone(), None, 1)
            .await?;
        if let Some(newest_email) = page.emails.into_iter().next() {
            return Ok(Some(newest_email));
        }
        if tokio::time::Instant::now() >= wait_deadline {
            return Ok(None);
        }
        tokio::time::sleep(WAIT_POLL_INTERVAL).await;
    }
}

/// A timeout like `30s` as a duration; a missing one is `default_duration`.
pub fn read_wait_duration(
    timeout_text: Option<&str>,
    default_duration: Duration,
) -> Result<Duration, OperationError> {
    match timeout_text {
        None => Ok(default_duration),
        Some(timeout_text) => sendmock_core::parse_duration_ms(timeout_text)
            .map(Duration::from_millis)
            .ok_or_else(|| OperationError::InvalidInput {
                message: format!(
                    "`timeout` must be a duration such as 30s or 500ms, not {timeout_text}"
                ),
                field: Some("timeout".to_owned()),
            }),
    }
}
