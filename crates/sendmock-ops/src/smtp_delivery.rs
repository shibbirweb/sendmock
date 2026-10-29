use sendmock_mail::{EmailEnvelope, IncomingEmail, IngestOptions};
use sendmock_store::SmtpSessionRecord;

use crate::{OperationContext, OperationError};

/// A message as an SMTP session received it.
#[derive(Debug, Clone)]
pub struct SmtpMessage {
    pub raw_message: Vec<u8>,
    pub mail_from: String,
    pub recipients: Vec<String>,
    pub smtp_session_id: String,
    pub auth_user: Option<String>,
}

/// Stores an SMTP message through the same path as every other email; answers its id.
pub async fn store_smtp_message(
    operation_context: &OperationContext,
    smtp_message: SmtpMessage,
) -> Result<String, OperationError> {
    let incoming_email = IncomingEmail {
        raw_message: smtp_message.raw_message,
        envelope: EmailEnvelope {
            mail_from: smtp_message.mail_from,
            recipients: smtp_message.recipients,
        },
        source: "smtp".to_owned(),
        direction: "outbound".to_owned(),
        smtp_session_id: Some(smtp_message.smtp_session_id),
        smtp_auth_user: smtp_message.auth_user,
        extra_tags: Vec::new(),
    };
    let stored_email = operation_context
        .email_ingest_service
        .ingest(incoming_email, &IngestOptions::default())
        .await
        .map_err(|mail_error| OperationError::Internal(mail_error.to_string()))?;
    Ok(stored_email.email_id)
}

pub async fn record_smtp_session(
    operation_context: &OperationContext,
    session: SmtpSessionRecord,
) -> Result<(), OperationError> {
    Ok(operation_context
        .smtp_session_repository
        .insert_session(session)
        .await?)
}
