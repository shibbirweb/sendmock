use sendmock_core::format_rfc5322;
use serde_json::{Value, json};

use crate::twilio_accounts::TwilioAccount;

pub const ACCOUNT_PATH_PREFIX: &str = "/2010-04-01/Accounts/";
const SUBRESOURCE_NAMES: [&str; 8] = [
    "messages",
    "incoming_phone_numbers",
    "notifications",
    "calls",
    "queues",
    "recordings",
    "usage",
    "balance",
];

/// Twilio's Account resource.
pub fn describe_account(account: &TwilioAccount) -> Value {
    let account_uri = format!("{ACCOUNT_PATH_PREFIX}{}", account.account_sid);
    let subresource_uris: serde_json::Map<String, Value> = SUBRESOURCE_NAMES
        .iter()
        .map(|subresource_name| {
            let file_name = match *subresource_name {
                "incoming_phone_numbers" => "IncomingPhoneNumbers",
                "messages" => "Messages",
                "notifications" => "Notifications",
                "calls" => "Calls",
                "queues" => "Queues",
                "recordings" => "Recordings",
                "usage" => "Usage",
                _ => "Balance",
            };
            (
                (*subresource_name).to_owned(),
                Value::from(format!("{account_uri}/{file_name}.json")),
            )
        })
        .collect();
    json!({
        "auth_token": account.auth_token,
        "date_created": format_rfc5322(account.created_at_unix_ms),
        "date_updated": format_rfc5322(account.updated_at_unix_ms),
        "friendly_name": account.friendly_name,
        "owner_account_sid": account.owner_account_sid,
        "sid": account.account_sid,
        "status": account.status.as_str(),
        "subresource_uris": subresource_uris,
        "type": "Full",
        "uri": format!("{account_uri}.json"),
    })
}
