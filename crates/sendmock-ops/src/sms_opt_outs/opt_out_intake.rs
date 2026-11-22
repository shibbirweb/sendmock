//! Twilio's Advanced Opt-Out for texts your app receives: STOP records an opt-out, START lifts
//! it, and with auto-replies on each keyword is answered as Twilio answers it.

use sendmock_sms::OptOutKeyword;
use sendmock_store::{SmsOptOutRecord, SmsRecord};

use super::opt_out_auto_reply::send_opt_out_reply;
use crate::providers::{SMS_PROVIDER_AREA, find_area_provider};
use crate::twilio_accounts::TWILIO_PROVIDER_KEY;
use crate::{OperationContext, OperationError};

/// Applies an inbound keyword to the opt-outs and, with auto-replies on, answers it.
pub async fn respond_to_opt_out_keyword(
    operation_context: &OperationContext,
    inbound_sms: &SmsRecord,
) -> Result<(), OperationError> {
    let Some(outcome) = apply_opt_out_keyword(operation_context, inbound_sms).await? else {
        return Ok(());
    };
    if outcome.should_auto_reply {
        send_opt_out_reply(operation_context, inbound_sms, outcome.keyword).await?;
    }
    Ok(())
}

/// What an inbound text did to the opt-outs, so the caller can send Twilio's auto-reply.
pub struct OptOutOutcome {
    pub keyword: OptOutKeyword,
    pub should_auto_reply: bool,
}

/// Records or lifts the contact's opt-out when the inbound text is a keyword and the Twilio
/// provider emulates opt-outs; `None` for any other text, or with the emulation off.
async fn apply_opt_out_keyword(
    operation_context: &OperationContext,
    inbound_sms: &SmsRecord,
) -> Result<Option<OptOutOutcome>, OperationError> {
    let Some(keyword) = OptOutKeyword::classify(&inbound_sms.body) else {
        return Ok(None);
    };
    let Ok(twilio_provider) =
        find_area_provider(operation_context, SMS_PROVIDER_AREA, TWILIO_PROVIDER_KEY).await
    else {
        return Ok(None);
    };
    if !twilio_provider.has_opt_out_keywords() {
        return Ok(None);
    }
    let app_number = operation_context
        .virtual_number_repository
        .find_by_number(&inbound_sms.app_number)
        .await?;
    let opt_outs = &operation_context.sms_delivery_stores.opt_outs;
    match keyword {
        OptOutKeyword::Stop => {
            let sender = app_number
                .and_then(|registered_number| registered_number.messaging_service_sid)
                .unwrap_or_else(|| inbound_sms.app_number.clone());
            opt_outs
                .save_opt_out(SmsOptOutRecord {
                    sender,
                    contact_number: inbound_sms.contact_number.clone(),
                    keyword: inbound_sms.body.trim().to_owned(),
                    created_at_unix_ms: operation_context.clock.now_unix_ms(),
                })
                .await?;
        }
        OptOutKeyword::Start => {
            let mut senders = vec![inbound_sms.app_number.clone()];
            senders.extend(
                app_number.and_then(|registered_number| registered_number.messaging_service_sid),
            );
            for sender in senders {
                opt_outs
                    .delete_opt_out(&sender, &inbound_sms.contact_number)
                    .await?;
            }
        }
        OptOutKeyword::Help => {}
    }
    Ok(Some(OptOutOutcome {
        keyword,
        should_auto_reply: twilio_provider.opt_out_auto_replies,
    }))
}
