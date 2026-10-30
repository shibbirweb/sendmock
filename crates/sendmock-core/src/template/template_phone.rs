//! Phone helpers for templates: the `e164`, `phone_country` and `phone_national` filters and
//! the numbers `random_phone` makes. A short calling code table covers the common countries;
//! `+1` reads as `US`, since the plan does not split the North American numbering plan.

use crate::RandomSource;

struct CallingCode {
    country_code: &'static str,
    dial_code: &'static str,
    national_digit_count: usize,
}

const fn calling_code(
    country_code: &'static str,
    dial_code: &'static str,
    national_digit_count: usize,
) -> CallingCode {
    CallingCode {
        country_code,
        dial_code,
        national_digit_count,
    }
}

const CALLING_CODES: &[CallingCode] = &[
    calling_code("US", "1", 10),
    calling_code("CA", "1", 10),
    calling_code("GB", "44", 10),
    calling_code("BD", "880", 10),
    calling_code("IN", "91", 10),
    calling_code("PK", "92", 10),
    calling_code("DE", "49", 11),
    calling_code("FR", "33", 9),
    calling_code("ES", "34", 9),
    calling_code("IT", "39", 10),
    calling_code("NL", "31", 9),
    calling_code("IE", "353", 9),
    calling_code("SE", "46", 9),
    calling_code("PL", "48", 9),
    calling_code("TR", "90", 10),
    calling_code("RU", "7", 10),
    calling_code("AU", "61", 9),
    calling_code("NZ", "64", 9),
    calling_code("JP", "81", 10),
    calling_code("KR", "82", 10),
    calling_code("CN", "86", 11),
    calling_code("SG", "65", 8),
    calling_code("PH", "63", 10),
    calling_code("ID", "62", 10),
    calling_code("AE", "971", 9),
    calling_code("SA", "966", 9),
    calling_code("ZA", "27", 9),
    calling_code("NG", "234", 10),
    calling_code("BR", "55", 11),
    calling_code("MX", "52", 10),
];

/// Drops spaces, dashes, dots and brackets, and turns a leading `00` into `+`; a number
/// without a country code stays as it was written.
pub fn format_e164(phone_text: &str) -> String {
    let compact: String = phone_text
        .chars()
        .filter(|character| !matches!(character, ' ' | '-' | '.' | '(' | ')' | '\u{a0}'))
        .collect();
    if let Some(international_digits) = compact.strip_prefix("00") {
        return format!("+{international_digits}");
    }
    if compact.starts_with('+') {
        return compact;
    }
    phone_text.trim().to_owned()
}

fn find_calling_code(phone_text: &str) -> Option<&'static CallingCode> {
    let e164_number = format_e164(phone_text);
    let international_digits = e164_number.strip_prefix('+')?;
    CALLING_CODES
        .iter()
        .filter(|calling_code| international_digits.starts_with(calling_code.dial_code))
        // The first of equal matches wins, so `+1` reads as `US`.
        .rev()
        .max_by_key(|calling_code| calling_code.dial_code.len())
}

/// The ISO country code of an international number, or an empty string.
pub fn find_phone_country(phone_text: &str) -> String {
    find_calling_code(phone_text)
        .map(|calling_code| calling_code.country_code.to_owned())
        .unwrap_or_default()
}

/// The digits after the calling code, or every digit when the country is unknown.
pub fn read_national_number(phone_text: &str) -> String {
    let digits: String = format_e164(phone_text)
        .chars()
        .filter(char::is_ascii_digit)
        .collect();
    match find_calling_code(phone_text) {
        Some(calling_code) => digits[calling_code.dial_code.len()..].to_owned(),
        None => digits,
    }
}

fn random_digit(random_source: &dyn RandomSource, smallest_digit: u64) -> char {
    let digit = smallest_digit + random_source.next_u64() % (10 - smallest_digit);
    char::from(b'0' + u8::try_from(digit).unwrap_or(0))
}

/// An E.164 number for a country (US when unknown). US numbers use the fictional
/// `555-01XX` range, so a generated number never reaches a real person.
pub fn generate_random_phone(random_source: &dyn RandomSource, country_code: &str) -> String {
    let calling_code = CALLING_CODES
        .iter()
        .find(|calling_code| calling_code.country_code.eq_ignore_ascii_case(country_code))
        .unwrap_or(&CALLING_CODES[0]);
    if calling_code.dial_code == "1" {
        let area_code: String = (0..3)
            .map(|position| random_digit(random_source, if position == 0 { 2 } else { 0 }))
            .collect();
        let line_end: String = (0..2).map(|_| random_digit(random_source, 0)).collect();
        return format!("+1{area_code}55501{line_end}");
    }
    let national_number: String = (0..calling_code.national_digit_count)
        .map(|position| random_digit(random_source, if position == 0 { 1 } else { 0 }))
        .collect();
    format!("+{}{national_number}", calling_code.dial_code)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::SeededRandomSource;

    #[test]
    fn numbers_are_written_in_e164() {
        assert_eq!(format_e164("+1 (415) 555-0100"), "+14155550100");
        assert_eq!(format_e164("0044 20 7946 0000"), "+442079460000");
        assert_eq!(format_e164(" 555 0100 "), "555 0100");
    }

    #[test]
    fn the_longest_calling_code_names_the_country() {
        assert_eq!(find_phone_country("+8801712345678"), "BD");
        assert_eq!(find_phone_country("+14155550100"), "US");
        assert_eq!(find_phone_country("555 0100"), "");
        assert_eq!(read_national_number("+44 20 7946 0000"), "2079460000");
    }

    #[test]
    fn random_us_numbers_stay_in_the_fictional_range() {
        let random_source = SeededRandomSource::new(3);

        let us_number = generate_random_phone(&random_source, "us");
        let british_number = generate_random_phone(&random_source, "GB");

        assert_eq!(us_number.len(), 12);
        assert_eq!(&us_number[5..10], "55501");
        assert!(british_number.starts_with("+44"));
        assert_eq!(british_number.len(), 13);
    }
}
