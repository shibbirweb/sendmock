/// Calling codes SendMock names a country for, longest first so `+880` wins over `+88`.
/// `+1` is the United States, as Twilio answers for a North American number it cannot place.
const COUNTRY_CALLING_CODES: [(&str, &str); 12] = [
    ("+880", "BD"),
    ("+234", "NG"),
    ("+254", "KE"),
    ("+971", "AE"),
    ("+44", "GB"),
    ("+49", "DE"),
    ("+33", "FR"),
    ("+34", "ES"),
    ("+61", "AU"),
    ("+91", "IN"),
    ("+55", "BR"),
    ("+1", "US"),
];

/// The ISO country of an E.164 number from its calling code; none when SendMock does not
/// know the code.
pub fn find_number_country(e164_number: &str) -> Option<&'static str> {
    COUNTRY_CALLING_CODES
        .iter()
        .find(|(calling_code, _)| e164_number.starts_with(calling_code))
        .map(|(_, country_code)| *country_code)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_number_is_placed_by_its_longest_calling_code() {
        assert_eq!(find_number_country("+8801711000000"), Some("BD"));
        assert_eq!(find_number_country("+447700900123"), Some("GB"));
        assert_eq!(find_number_country("+15550001111"), Some("US"));
        assert_eq!(find_number_country("+8613800000000"), None);
    }
}
