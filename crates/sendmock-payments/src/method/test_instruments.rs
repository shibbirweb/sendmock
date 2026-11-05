/// Card ranges reserved for testing; a test card must start with one, so a real card can never
/// be saved as a test card.
pub const TEST_CARD_PREFIXES: [&str; 4] = ["424242424242", "400000", "400002", "555555555555"];

/// Digits only, so "4242 4242 ..." and "4242-4242-..." match the table.
pub fn to_card_digits(card_number: &str) -> String {
    card_number
        .chars()
        .filter(|character| !character.is_whitespace() && *character != '-')
        .collect()
}

/// A test number or voucher code as typed, without spaces or dashes and in capitals.
pub fn to_test_number(typed_number: &str) -> String {
    to_card_digits(typed_number).to_ascii_uppercase()
}

/// The Luhn checksum every real card number passes; 12 to 19 digits.
pub fn passes_luhn_check(card_digits: &str) -> bool {
    if !(12..=19).contains(&card_digits.len())
        || !card_digits.chars().all(|digit| digit.is_ascii_digit())
    {
        return false;
    }
    let digit_sum: u32 = card_digits
        .chars()
        .rev()
        .enumerate()
        .map(|(digit_index, digit)| {
            let digit_value = digit.to_digit(10).unwrap_or_default();
            let weighted_digit = if digit_index % 2 == 1 {
                digit_value * 2
            } else {
                digit_value
            };
            if weighted_digit > 9 {
                weighted_digit - 9
            } else {
                weighted_digit
            }
        })
        .sum();
    digit_sum.is_multiple_of(10)
}

pub fn is_test_card_range(card_digits: &str) -> bool {
    TEST_CARD_PREFIXES
        .iter()
        .any(|test_prefix| card_digits.starts_with(test_prefix))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn checks_card_numbers_the_way_card_networks_do() {
        assert!(passes_luhn_check(&to_card_digits("4242 4242 4242 4242")));
        assert!(passes_luhn_check("4000002500003155"));
        assert!(!passes_luhn_check("4242424242424241"));
        assert!(!passes_luhn_check("42424242"));
        assert!(is_test_card_range("4000000000009995"));
        assert!(!is_test_card_range("4111111111111111"));
        assert_eq!(to_test_number("bkash-0177 0000"), "BKASH01770000");
    }
}
