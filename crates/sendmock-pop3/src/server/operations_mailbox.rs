use sendmock_ops::{
    OperationContext, Pop3MailboxMessage, delete_pop3_messages, open_pop3_mailbox,
    read_pop3_message,
};

use crate::protocol::{Pop3Mailbox, Pop3MailboxError};

/// The mailbox over SendMock's operations: the project the username names, the stored raw
/// messages, and deletes that fire `email.deleted` as the API's do.
pub struct OperationsMailbox {
    operation_context: OperationContext,
}

impl OperationsMailbox {
    pub fn new(operation_context: OperationContext) -> Self {
        Self { operation_context }
    }
}

fn to_mailbox_error(operation_error: sendmock_ops::OperationError) -> Pop3MailboxError {
    Pop3MailboxError(operation_error.to_string())
}

impl Pop3Mailbox for OperationsMailbox {
    async fn open(&self, username: &str) -> Result<Vec<Pop3MailboxMessage>, Pop3MailboxError> {
        open_pop3_mailbox(&self.operation_context, username)
            .await
            .map_err(to_mailbox_error)
    }

    async fn read_message(&self, email_id: &str) -> Result<Vec<u8>, Pop3MailboxError> {
        read_pop3_message(&self.operation_context, email_id)
            .await
            .map_err(to_mailbox_error)
    }

    async fn delete_messages(&self, email_ids: &[String]) -> Result<(), Pop3MailboxError> {
        delete_pop3_messages(&self.operation_context, email_ids)
            .await
            .map_err(to_mailbox_error)
    }
}
