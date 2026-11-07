/// The conversation a message belongs to: the channel, your app's number and the contact's
/// number, the same for both directions, so a reply lands in the thread it answers.
pub fn build_thread_id(is_whatsapp: bool, app_number: &str, contact_number: &str) -> String {
    let channel = if is_whatsapp { "whatsapp" } else { "sms" };
    format!(
        "{channel}-{}-{}",
        keep_url_safe(app_number),
        keep_url_safe(contact_number)
    )
}

fn keep_url_safe(number: &str) -> String {
    number.chars().filter(char::is_ascii_alphanumeric).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn both_directions_share_one_thread() {
        let outbound_thread = build_thread_id(false, "+15550001111", "+8801700000000");
        let inbound_thread = build_thread_id(false, "+15550001111", "+8801700000000");

        assert_eq!(outbound_thread, "sms-15550001111-8801700000000");
        assert_eq!(outbound_thread, inbound_thread);
        assert_ne!(
            build_thread_id(true, "+15550001111", "+8801700000000"),
            outbound_thread
        );
    }
}
