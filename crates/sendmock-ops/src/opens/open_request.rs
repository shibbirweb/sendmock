use sendmock_store::MessageOpenRecord;

use super::OpenSource;
use crate::{OperationContext, OperationError};

/// Longer than any browser sends; it keeps the open history readable.
const MAX_USER_AGENT_LENGTH: usize = 512;

/// The user agent an open or click sends, trimmed (a blank one is none) and not too long.
pub(crate) fn read_user_agent(
    user_agent: Option<String>,
) -> Result<Option<String>, OperationError> {
    let user_agent = user_agent
        .map(|user_agent| user_agent.trim().to_owned())
        .filter(|user_agent| !user_agent.is_empty());
    if user_agent
        .as_ref()
        .is_some_and(|user_agent| user_agent.chars().count() > MAX_USER_AGENT_LENGTH)
    {
        return Err(OperationError::InvalidInput {
            message: format!("`user_agent` must be at most {MAX_USER_AGENT_LENGTH} characters"),
            field: Some("user_agent".to_owned()),
        });
    }
    Ok(user_agent)
}

/// The open as it is stored: now, from the source, with the user agent read as above.
pub(crate) fn build_open_record(
    operation_context: &OperationContext,
    open_source: OpenSource,
    user_agent: Option<String>,
) -> Result<MessageOpenRecord, OperationError> {
    Ok(MessageOpenRecord {
        opened_at_unix_ms: operation_context.clock.now_unix_ms(),
        source: open_source.as_str().to_owned(),
        user_agent: read_user_agent(user_agent)?,
    })
}
