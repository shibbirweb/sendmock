/// A number as the app sent it, with its E.164 form when it has one. Alphanumeric sender
/// IDs ("ACME") and short codes stay as they were.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PhoneNumber {
    raw: String,
    e164: Option<String>,
}

/// E.164 allows at most 15 digits; fewer than 7 is a short code, not a phone number.
const MINIMUM_E164_DIGITS: usize = 7;
const MAXIMUM_E164_DIGITS: usize = 15;

impl PhoneNumber {
    /// Drops spaces, dashes, dots and brackets; `00` becomes `+`. A number without a country
    /// code keeps its digits but has no E.164 form, since the country cannot be guessed.
    pub fn parse(raw_number: &str) -> Self {
        let raw = raw_number.trim().to_owned();
        let compact: String = raw
            .chars()
            .filter(|character| !matches!(character, ' ' | '-' | '.' | '(' | ')' | '\u{a0}'))
            .collect();
        let international_digits = compact
            .strip_prefix('+')
            .or_else(|| compact.strip_prefix("00"));
        let e164 = international_digits
            .filter(|digits| {
                digits.chars().all(|character| character.is_ascii_digit())
                    && (MINIMUM_E164_DIGITS..=MAXIMUM_E164_DIGITS).contains(&digits.len())
                    && !digits.starts_with('0')
            })
            .map(|digits| format!("+{digits}"));
        Self { raw, e164 }
    }

    pub fn raw(&self) -> &str {
        &self.raw
    }

    pub fn e164(&self) -> Option<&str> {
        self.e164.as_deref()
    }

    /// The form stored and shown: E.164 when there is one, else what the app sent.
    pub fn normalized(&self) -> &str {
        self.e164.as_deref().unwrap_or(&self.raw)
    }
}

/// The channel an address names: `whatsapp:+1555...` is WhatsApp, anything else SMS.
pub fn split_channel_prefix(address: &str) -> (bool, &str) {
    match address.trim().strip_prefix("whatsapp:") {
        Some(whatsapp_number) => (true, whatsapp_number),
        None => (false, address.trim()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: SM-01.4
    #[test]
    fn normalises_to_e164_and_keeps_the_raw_value() {
        let formatted = PhoneNumber::parse("+1 (555) 000-1111");
        let with_zeros = PhoneNumber::parse("00880 1700 000000");

        assert_eq!(formatted.e164(), Some("+15550001111"));
        assert_eq!(formatted.raw(), "+1 (555) 000-1111");
        assert_eq!(with_zeros.normalized(), "+8801700000000");
    }

    #[test]
    fn sender_ids_short_codes_and_local_numbers_stay_as_sent() {
        assert_eq!(PhoneNumber::parse("ACME").normalized(), "ACME");
        assert_eq!(PhoneNumber::parse("12345").e164(), None);
        assert_eq!(
            PhoneNumber::parse("01700000000").normalized(),
            "01700000000"
        );
    }

    #[test]
    fn reads_the_whatsapp_prefix() {
        assert_eq!(
            split_channel_prefix("whatsapp:+15550001111"),
            (true, "+15550001111")
        );
        assert_eq!(
            split_channel_prefix("+15550001111"),
            (false, "+15550001111")
        );
    }
}
