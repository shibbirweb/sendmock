use std::time::Duration;

use sendmock_store::VerificationRecord;

use crate::{OperationContext, OperationError};

const WAIT_POLL_INTERVAL: Duration = Duration::from_millis(100);

/// The recipient's newest verification, waiting up to `wait_duration` for one to start.
pub async fn find_newest_verification(
    operation_context: &OperationContext,
    to_address: &str,
    wait_duration: Duration,
) -> Result<Option<VerificationRecord>, OperationError> {
    let wait_deadline = tokio::time::Instant::now() + wait_duration;
    loop {
        if let Some(verification) = operation_context
            .verification_repository
            .find_newest_for_recipient(to_address.trim())
            .await?
        {
            return Ok(Some(verification));
        }
        if tokio::time::Instant::now() >= wait_deadline {
            return Ok(None);
        }
        tokio::time::sleep(WAIT_POLL_INTERVAL).await;
    }
}
