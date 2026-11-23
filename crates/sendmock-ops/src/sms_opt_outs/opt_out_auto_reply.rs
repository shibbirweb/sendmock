use sendmock_sms::{OptOutKeyword, SendDecision};
use sendmock_store::SmsRecord;

use crate::sms::{
    AcceptedMedia, IncomingSms, decide_outbound_send, generate_message_sid, start_sms_delivery,
    store_sms,
};
use crate::twilio_accounts::TWILIO_PROVIDER_KEY;
use crate::{OperationContext, OperationError};

/// Twilio's default answer to an opt-out keyword, sent from your number to the contact and
/// stored as an outbound Twilio message that replies to the keyword.
pub async fn send_opt_out_reply(
    operation_context: &OperationContext,
    inbound_sms: &SmsRecord,
    keyword: OptOutKeyword,
) -> Result<(), OperationError> {
    let (reply_from, reply_to) = (inbound_sms.to_raw.clone(), inbound_sms.from_raw.clone());
    let SendDecision::Accepted(delivery_steps) =
        decide_outbound_send(operation_context, &reply_to, &reply_from).await?
    else {
        return Ok(());
    };
    let reply_sms = store_sms(
        operation_context,
        IncomingSms {
            is_inbound: false,
            api: TWILIO_PROVIDER_KEY.to_owned(),
            from: reply_from,
            to: reply_to,
            body: keyword.default_reply().to_owned(),
            status: "queued".to_owned(),
            error_code: None,
            status_callback_url: None,
            messaging_service_sid: None,
            account: inbound_sms.account.clone(),
            metadata_json: None,
            request_body_json: None,
            provider_id: Some(generate_message_sid(operation_context)),
            in_reply_to_sms_id: Some(inbound_sms.sms_id.clone()),
            media: AcceptedMedia::default(),
        },
    )
    .await?;
    start_sms_delivery(operation_context, reply_sms, delivery_steps).await?;
    Ok(())
}
