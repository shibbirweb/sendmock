/// How a magic device token makes a push fail, like SMS's magic numbers: the token contains
/// the word, in any case.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PushTokenFailure {
    Unregistered,
    Invalid,
    Throttled,
}

/// The failure a token asks for, or `None` for a token that is delivered.
pub fn read_push_token_failure(device_token: &str) -> Option<PushTokenFailure> {
    let lowercase_token = device_token.to_ascii_lowercase();
    [
        ("unregistered", PushTokenFailure::Unregistered),
        ("invalid", PushTokenFailure::Invalid),
        ("throttled", PushTokenFailure::Throttled),
    ]
    .into_iter()
    .find(|(magic_word, _)| lowercase_token.contains(magic_word))
    .map(|(_, token_failure)| token_failure)
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PN-01.4
    #[test]
    fn a_token_naming_a_failure_in_any_case_asks_for_it() {
        assert_eq!(
            read_push_token_failure("ExponentPushToken[UNREGISTERED-1]"),
            Some(PushTokenFailure::Unregistered)
        );
        assert_eq!(
            read_push_token_failure("device-invalid"),
            Some(PushTokenFailure::Invalid)
        );
        assert_eq!(
            read_push_token_failure("throttled-device"),
            Some(PushTokenFailure::Throttled)
        );
        assert_eq!(read_push_token_failure("dQw4w9WgXcQ:APA91bE1"), None);
    }
}
