use sendmock_store::MessageOpenRecord;
use serde_json::{Value, json};

/// Adds what `email.opened` and `sms.opened` carry beyond the message: whether this was the
/// first open, where it came from and the user agent. The message's own `open_count` and
/// `opened_at` (the first open) stay as the list shows them.
pub(crate) fn add_open_fields(
    mut event_data: Value,
    message_open: &MessageOpenRecord,
    open_count: u64,
) -> Value {
    if let Some(data_fields) = event_data.as_object_mut() {
        data_fields.extend([
            ("first_open".to_owned(), json!(open_count == 1)),
            ("open_count".to_owned(), json!(open_count)),
            ("source".to_owned(), json!(message_open.source)),
            ("user_agent".to_owned(), json!(message_open.user_agent)),
        ]);
    }
    event_data
}
