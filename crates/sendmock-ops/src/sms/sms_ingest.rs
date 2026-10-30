use sendmock_mail::extract_links;
use sendmock_sms::{PhoneNumber, build_thread_id, count_segments, split_channel_prefix};
use sendmock_store::{NewSmsRecord, SmsRecord};

use super::sms_media_intake::AcceptedMedia;
use super::sms_views::SmsMessage;
use crate::{AppEventType, OperationContext, OperationError, publish_event, read_ingest_options};

/// A message as an API received it, before it is stored.
#[derive(Debug, Clone)]
pub struct IncomingSms {
    pub is_inbound: bool,
    pub api: String,
    pub from: String,
    pub to: String,
    pub body: String,
    pub status: String,
    pub error_code: Option<String>,
    pub status_callback_url: Option<String>,
    pub messaging_service_sid: Option<String>,
    pub account: Option<String>,
    pub metadata_json: Option<String>,
    pub request_body_json: Option<String>,
    /// The provider's id format; `None` uses the message id.
    pub provider_id: Option<String>,
    pub media: AcceptedMedia,
}

/// Normalises the numbers, counts segments, extracts codes and links, stores the message
/// and publishes `sms.sent` (or `sms.inbound`) with the message as lists show it.
pub async fn store_sms(
    operation_context: &OperationContext,
    incoming_sms: IncomingSms,
) -> Result<SmsRecord, OperationError> {
    let ingest_options = read_ingest_options(operation_context).await?;
    let otp_codes = ingest_options
        .otp_extractor
        .extract_codes(&incoming_sms.body);
    let sms_id = operation_context.id_generator.generate_id().to_string();
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let is_inbound = incoming_sms.is_inbound;
    let (sms, media_contents) = build_sms_record(incoming_sms, sms_id, now_unix_ms, otp_codes);
    operation_context
        .sms_repository
        .insert_message(NewSmsRecord {
            sms: sms.clone(),
            media_contents,
        })
        .await?;
    let event_type = if is_inbound {
        AppEventType::SmsInbound
    } else {
        AppEventType::SmsSent
    };
    publish_event(
        operation_context,
        event_type,
        serde_json::to_value(SmsMessage::from(&sms)).unwrap_or_default(),
    );
    Ok(sms)
}

/// Both numbers parsed, which one is your app's, and whether it is WhatsApp.
struct ConversationNumbers {
    is_whatsapp: bool,
    from_number: PhoneNumber,
    to_number: PhoneNumber,
    app_number: String,
    contact_number: String,
}

fn resolve_numbers(from_address: &str, to_address: &str, is_inbound: bool) -> ConversationNumbers {
    let (from_is_whatsapp, from_address) = split_channel_prefix(from_address);
    let (to_is_whatsapp, to_address) = split_channel_prefix(to_address);
    let (from_number, to_number) = (
        PhoneNumber::parse(from_address),
        PhoneNumber::parse(to_address),
    );
    let (app_number, contact_number) = if is_inbound {
        (
            to_number.normalized().to_owned(),
            from_number.normalized().to_owned(),
        )
    } else {
        (
            from_number.normalized().to_owned(),
            to_number.normalized().to_owned(),
        )
    };
    ConversationNumbers {
        is_whatsapp: from_is_whatsapp || to_is_whatsapp,
        from_number,
        to_number,
        app_number,
        contact_number,
    }
}

fn build_sms_record(
    incoming_sms: IncomingSms,
    sms_id: String,
    now_unix_ms: i64,
    otp_codes: Vec<String>,
) -> (SmsRecord, Vec<Vec<u8>>) {
    let numbers = resolve_numbers(
        &incoming_sms.from,
        &incoming_sms.to,
        incoming_sms.is_inbound,
    );
    let (is_whatsapp, from_number, to_number) =
        (numbers.is_whatsapp, numbers.from_number, numbers.to_number);
    let (app_number, contact_number) = (numbers.app_number, numbers.contact_number);
    let direction = if incoming_sms.is_inbound {
        "inbound"
    } else {
        "outbound"
    };
    let segment_count = count_segments(&incoming_sms.body);
    let sms = SmsRecord {
        provider_id: incoming_sms.provider_id.unwrap_or_else(|| sms_id.clone()),
        direction: direction.to_owned(),
        channel: if is_whatsapp { "whatsapp" } else { "sms" }.to_owned(),
        api: incoming_sms.api,
        from_number: from_number.normalized().to_owned(),
        from_raw: from_number.raw().to_owned(),
        to_number: to_number.normalized().to_owned(),
        to_raw: to_number.raw().to_owned(),
        thread_id: build_thread_id(is_whatsapp, &app_number, &contact_number),
        app_number,
        contact_number,
        encoding: segment_count.encoding.as_str().to_owned(),
        segments: segment_count.segments,
        status: incoming_sms.status,
        error_code: incoming_sms.error_code,
        status_callback_url: incoming_sms.status_callback_url,
        messaging_service_sid: incoming_sms.messaging_service_sid,
        account: incoming_sms.account,
        otp_codes,
        links: extract_links(Some(&incoming_sms.body), None),
        metadata_json: incoming_sms.metadata_json,
        request_body_json: incoming_sms.request_body_json,
        api_request_id: None,
        opened_at_unix_ms: None,
        open_count: 0,
        is_read: !incoming_sms.is_inbound,
        in_reply_to_sms_id: None,
        created_at_unix_ms: now_unix_ms,
        updated_at_unix_ms: now_unix_ms,
        media: incoming_sms.media.media,
        body: incoming_sms.body,
        sms_id,
    };
    (sms, incoming_sms.media.contents)
}
