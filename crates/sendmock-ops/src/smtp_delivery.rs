use sendmock_mail::{EmailEnvelope, IncomingEmail};
use sendmock_store::SmtpSessionRecord;

use crate::projects::find_named_project;
use crate::{OperationContext, OperationError, complete_email_intake, read_ingest_options};

/// A message as an SMTP session received it.
#[derive(Debug, Clone)]
pub struct SmtpMessage {
    pub raw_message: Vec<u8>,
    pub mail_from: String,
    pub recipients: Vec<String>,
    pub smtp_session_id: String,
    pub auth_user: Option<String>,
}

/// Stores an SMTP message through the same path as every other email; answers its id. An
/// AUTH username that is a project's key sends the message to that project.
pub async fn store_smtp_message(
    operation_context: &OperationContext,
    smtp_message: SmtpMessage,
) -> Result<String, OperationError> {
    match find_named_project(operation_context, smtp_message.auth_user.as_deref()).await? {
        Some(project_key) => {
            let project_context = operation_context.clone().with_project_key(&project_key);
            store_in_project(&project_context, smtp_message).await
        }
        None => store_in_project(operation_context, smtp_message).await,
    }
}

async fn store_in_project(
    operation_context: &OperationContext,
    smtp_message: SmtpMessage,
) -> Result<String, OperationError> {
    let inbound_domains = operation_context
        .settings_store
        .current()
        .await?
        .inbound_email_domains;
    let direction = if is_for_inbound_domains(&smtp_message.recipients, &inbound_domains) {
        "inbound"
    } else {
        "outbound"
    };
    let incoming_email = IncomingEmail {
        raw_message: smtp_message.raw_message,
        envelope: EmailEnvelope {
            mail_from: smtp_message.mail_from,
            recipients: smtp_message.recipients,
        },
        source: "smtp".to_owned(),
        direction: direction.to_owned(),
        smtp_session_id: Some(smtp_message.smtp_session_id),
        smtp_auth_user: smtp_message.auth_user,
        extra_tags: Vec::new(),
    };
    let stored_email = operation_context
        .email_ingest_service
        .ingest(
            incoming_email,
            &read_ingest_options(operation_context).await?,
        )
        .await
        .map_err(|mail_error| OperationError::Internal(mail_error.to_string()))?;
    complete_email_intake(operation_context, &stored_email).await?;
    Ok(stored_email.email_id)
}

/// Mail whose every recipient is at an inbound domain is mail coming in to your app
/// (EM-17.2); domains match without case.
fn is_for_inbound_domains(recipients: &[String], inbound_domains: &[String]) -> bool {
    !recipients.is_empty()
        && !inbound_domains.is_empty()
        && recipients.iter().all(|recipient| {
            recipient
                .rsplit_once('@')
                .is_some_and(|(_, recipient_domain)| {
                    inbound_domains
                        .iter()
                        .any(|inbound_domain| inbound_domain.eq_ignore_ascii_case(recipient_domain))
                })
        })
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

#[cfg(test)]
mod tests {
    use super::*;

    // AC: EM-17.2
    #[test]
    fn mail_counts_as_incoming_only_when_every_recipient_is_at_an_inbound_domain() {
        let inbound_domains = vec!["Reply.App.test".to_owned()];
        let recipients = |addresses: &[&str]| -> Vec<String> {
            addresses
                .iter()
                .map(|address| (*address).to_owned())
                .collect()
        };

        assert!(is_for_inbound_domains(
            &recipients(&["support@reply.app.test"]),
            &inbound_domains
        ));
        assert!(!is_for_inbound_domains(
            &recipients(&["support@reply.app.test", "sam@example.test"]),
            &inbound_domains
        ));
        assert!(!is_for_inbound_domains(
            &recipients(&["support@reply.app.test"]),
            &[]
        ));
    }
}
