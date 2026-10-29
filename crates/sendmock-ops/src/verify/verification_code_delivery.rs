use sendmock_core::format_rfc5322;
use sendmock_mail::{EmailEnvelope, IncomingEmail};
use sendmock_sms::SendDecision;

use crate::sms::{IncomingSms, decide_outbound_send, start_sms_delivery, store_sms};
use crate::{OperationContext, OperationError, publish_email_received, read_ingest_options};

/// The number Verify codes come from, as in the demo data.
const VERIFY_SENDER_NUMBER: &str = "+15550002222";
const VERIFY_SENDER_ADDRESS: &str = "verify@sendmock.test";
/// The provider key captured Verify messages carry.
const VERIFY_API: &str = "twilio_verify";

/// Where the code went: the captured message and its conversation, if any.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DeliveredCode {
    pub linked_message_id: Option<String>,
    pub linked_thread_id: Option<String>,
    /// For the timeline: "Code sent as an SMS".
    pub delivery_detail: String,
}

/// Delivers a code the way its channel would: a captured SMS for `sms` and `whatsapp` (through
/// the delivery simulation), a captured email for `email`, and nothing for `call`, which the
/// Verify log records.
pub async fn deliver_verification_code(
    operation_context: &OperationContext,
    service_name: &str,
    to_address: &str,
    channel: &str,
    code: &str,
) -> Result<DeliveredCode, OperationError> {
    let code_text = format!("Your {service_name} verification code is: {code}");
    match channel {
        "sms" | "whatsapp" => {
            deliver_by_sms(operation_context, to_address, channel, code_text).await
        }
        "email" => deliver_by_email(operation_context, service_name, to_address, &code_text).await,
        _ => Ok(DeliveredCode {
            delivery_detail: "Code read out in a voice call (no audio is kept)".to_owned(),
            ..DeliveredCode::default()
        }),
    }
}

async fn deliver_by_sms(
    operation_context: &OperationContext,
    to_address: &str,
    channel: &str,
    code_text: String,
) -> Result<DeliveredCode, OperationError> {
    let with_channel = |number: &str| {
        if channel == "whatsapp" && !number.starts_with("whatsapp:") {
            format!("whatsapp:{number}")
        } else {
            number.to_owned()
        }
    };
    let (from, to) = (with_channel(VERIFY_SENDER_NUMBER), with_channel(to_address));
    let send_decision = decide_outbound_send(operation_context, &to, &from).await?;
    let (status, error_code, delivery_steps) = match send_decision {
        SendDecision::Accepted(delivery_steps) => ("queued", None, delivery_steps),
        SendDecision::Rejected { error_code, .. } => ("failed", Some(error_code), Vec::new()),
    };
    let sms = store_sms(
        operation_context,
        IncomingSms {
            is_inbound: false,
            api: VERIFY_API.to_owned(),
            from,
            to,
            body: code_text,
            status: status.to_owned(),
            error_code,
            status_callback_url: None,
            messaging_service_sid: None,
            account: None,
            metadata_json: None,
            request_body_json: None,
            provider_id: None,
            media: Default::default(),
        },
    )
    .await?;
    let delivered_code = DeliveredCode {
        linked_message_id: Some(sms.sms_id.clone()),
        linked_thread_id: Some(sms.thread_id.clone()),
        delivery_detail: if channel == "whatsapp" {
            "Code sent as a WhatsApp message"
        } else {
            "Code sent as an SMS"
        }
        .to_owned(),
    };
    if sms.status == "queued" {
        start_sms_delivery(operation_context, sms, delivery_steps).await?;
    }
    Ok(delivered_code)
}

async fn deliver_by_email(
    operation_context: &OperationContext,
    service_name: &str,
    to_address: &str,
    code_text: &str,
) -> Result<DeliveredCode, OperationError> {
    let message_id = format!(
        "{}@sendmock.local",
        operation_context.id_generator.generate_id()
    );
    let raw_message = format!(
        "From: {service_name} <{VERIFY_SENDER_ADDRESS}>\r\nTo: {to_address}\r\nSubject: Your {service_name} verification code\r\nDate: {}\r\nMessage-ID: <{message_id}>\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{code_text}\r\n",
        format_rfc5322(operation_context.clock.now_unix_ms())
    );
    let envelope = EmailEnvelope {
        mail_from: VERIFY_SENDER_ADDRESS.to_owned(),
        recipients: vec![to_address.to_owned()],
    };
    let stored_email = operation_context
        .email_ingest_service
        .ingest(
            IncomingEmail::sent_by_app(raw_message.into_bytes(), envelope, "verify"),
            &read_ingest_options(operation_context).await?,
        )
        .await
        .map_err(|mail_error| OperationError::Internal(mail_error.to_string()))?;
    publish_email_received(operation_context, &stored_email);
    Ok(DeliveredCode {
        linked_message_id: Some(stored_email.email_id),
        linked_thread_id: None,
        delivery_detail: "Code sent as an email".to_owned(),
    })
}
