//! What the POP3 listener reads and deletes, through the same repositories and events as the
//! REST API (docs/plan/32-after-1-0.md, A6).

use sendmock_store::{DEFAULT_PROJECT_KEY, EmailListFilter};

use crate::email::read_raw_message;
use crate::projects::find_named_project;
use crate::{OperationContext, OperationError, publish_email_deleted};

/// Like Mailpit's, a POP3 mailbox holds the newest 100 emails; older ones stay in SendMock.
pub const POP3_MAILBOX_SIZE: u32 = 100;

/// One message in a POP3 mailbox: its email id (the UIDL) and its size in octets.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pop3MailboxMessage {
    pub email_id: String,
    pub size_bytes: u64,
}

/// The mailbox a login opens: the project its username names, else `default`, with its newest
/// emails numbered oldest first, as POP3 clients expect.
pub async fn open_pop3_mailbox(
    operation_context: &OperationContext,
    username: &str,
) -> Result<Vec<Pop3MailboxMessage>, OperationError> {
    let project_key = find_named_project(operation_context, Some(username))
        .await?
        .unwrap_or_else(|| DEFAULT_PROJECT_KEY.to_owned());
    let filter = EmailListFilter {
        project_key: Some(project_key),
        ..EmailListFilter::default()
    };
    let newest_page = operation_context
        .email_repository
        .list_emails(filter, None, POP3_MAILBOX_SIZE)
        .await?;
    Ok(newest_page
        .emails
        .into_iter()
        .rev()
        .map(|stored_email| Pop3MailboxMessage {
            email_id: stored_email.email_id,
            size_bytes: stored_email.size_bytes,
        })
        .collect())
}

/// The message exactly as SendMock received it.
pub async fn read_pop3_message(
    operation_context: &OperationContext,
    email_id: &str,
) -> Result<Vec<u8>, OperationError> {
    read_raw_message(operation_context, email_id).await
}

/// Deletes the emails a client marked, as `DELETE /api/v1/emails/{emailId}` does: each one
/// still there fires `email.deleted`.
pub async fn delete_pop3_messages(
    operation_context: &OperationContext,
    email_ids: &[String],
) -> Result<(), OperationError> {
    for email_id in email_ids {
        if operation_context
            .email_repository
            .delete_email(email_id)
            .await?
        {
            publish_email_deleted(operation_context, Some(email_id), 1);
        }
    }
    Ok(())
}
