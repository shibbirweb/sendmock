use sendmock_core::format_rfc5322;
use sendmock_mail::{EmailEnvelope, IncomingEmail, build_raw_message};
use sendmock_store::EmailRecord;

use super::native_send_request::{NativeSendRequest, read_bare_address};
use crate::{OperationContext, OperationError, read_ingest_options};

/// Stores a raw message as mail coming in to your app; the caller completes the intake.
pub async fn store_inbound_raw_message(
    operation_context: &OperationContext,
    raw_message: Vec<u8>,
    envelope: EmailEnvelope,
) -> Result<EmailRecord, OperationError> {
    let incoming_email = IncomingEmail {
        direction: "inbound".to_owned(),
        ..IncomingEmail::sent_by_app(raw_message, envelope, "simulated")
    };
    operation_context
        .email_ingest_service
        .ingest(
            incoming_email,
            &read_ingest_options(operation_context).await?,
        )
        .await
        .map_err(|mail_error| OperationError::Internal(mail_error.to_string()))
}

/// Builds the message as the native send does and stores it as incoming mail.
pub async fn store_inbound_message(
    operation_context: &OperationContext,
    send_request: &NativeSendRequest,
) -> Result<EmailRecord, OperationError> {
    let native_message = send_request.to_native_message()?;
    let message_id = format!(
        "{}@sendmock.local",
        operation_context.id_generator.generate_id()
    );
    let raw_message = build_raw_message(
        &native_message,
        &message_id,
        &format_rfc5322(operation_context.clock.now_unix_ms()),
    );
    let envelope = EmailEnvelope {
        mail_from: read_bare_address(&send_request.from),
        recipients: send_request.envelope_recipients(),
    };
    store_inbound_raw_message(operation_context, raw_message, envelope).await
}
