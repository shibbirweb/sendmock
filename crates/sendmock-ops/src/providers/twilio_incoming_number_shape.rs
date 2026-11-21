use sendmock_core::format_rfc5322;
use sendmock_store::VirtualNumberRecord;
use serde_json::{Value, json};

use super::twilio_answers::read_form_field;

pub const ACCOUNTS_PREFIX: &str = "/2010-04-01/Accounts/";
pub const NUMBERS_SEGMENT: &str = "/IncomingPhoneNumbers";

/// The account a number belongs to: its own, or the main account's.
pub fn owner_of<'number>(
    stored_number: &'number VirtualNumberRecord,
    main_account_sid: &'number str,
) -> &'number str {
    stored_number
        .account_sid
        .as_deref()
        .unwrap_or(main_account_sid)
}

/// `FriendlyName`, `SmsUrl`, `SmsMethod`, `SmsFallbackUrl` and `StatusCallback`.
pub fn apply_fields(mut stored_number: VirtualNumberRecord, fields: &Value) -> VirtualNumberRecord {
    if let Some(friendly_name) = read_form_field(fields, "FriendlyName") {
        stored_number.label = friendly_name;
    }
    if let Some(sms_url) = read_form_field(fields, "SmsUrl") {
        stored_number.inbound_url = Some(sms_url);
    }
    if let Some(sms_method) = read_form_field(fields, "SmsMethod") {
        if sms_method.eq_ignore_ascii_case("GET") {
            stored_number.inbound_method = "GET".to_owned();
        } else {
            stored_number.inbound_method = "POST".to_owned();
        }
    }
    if let Some(sms_fallback_url) = read_form_field(fields, "SmsFallbackUrl") {
        stored_number.inbound_fallback_url = Some(sms_fallback_url);
    }
    if let Some(status_callback) = read_form_field(fields, "StatusCallback") {
        stored_number.status_callback_url = Some(status_callback);
    }
    stored_number
}

/// Twilio's IncomingPhoneNumber resource.
pub fn describe_number(stored_number: &VirtualNumberRecord, main_account_sid: &str) -> Value {
    let account_sid = owner_of(stored_number, main_account_sid);
    let created_at = format_rfc5322(stored_number.created_at_unix_ms);
    let has_sms = stored_number
        .channels
        .iter()
        .any(|channel| channel == "sms");
    json!({
        "account_sid": account_sid,
        "address_requirements": "none",
        "api_version": "2010-04-01",
        "beta": false,
        "capabilities": { "voice": false, "sms": has_sms, "mms": has_sms, "fax": false },
        "date_created": created_at,
        "date_updated": created_at,
        "friendly_name": stored_number.label,
        "origin": "twilio",
        "phone_number": stored_number.number,
        "sid": stored_number.phone_number_sid,
        "sms_application_sid": "",
        "sms_fallback_method": "POST",
        "sms_fallback_url": stored_number.inbound_fallback_url.clone().unwrap_or_default(),
        "sms_method": stored_number.inbound_method,
        "sms_url": stored_number.inbound_url.clone().unwrap_or_default(),
        "status": "in-use",
        "status_callback": stored_number.status_callback_url.clone().unwrap_or_default(),
        "status_callback_method": "POST",
        "uri": format!(
            "{ACCOUNTS_PREFIX}{account_sid}{NUMBERS_SEGMENT}/{}.json",
            stored_number.phone_number_sid
        ),
    })
}
