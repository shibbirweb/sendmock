const WHATSAPP_PREFIX: &str = "whatsapp:";

/// True when a number matches an outcome rule pattern: exact, or with `*` standing for any
/// characters. Case does not matter and a `whatsapp:` prefix on the number is ignored.
pub fn matches_outcome_pattern(pattern: &str, number: &str) -> bool {
    let compared_number = number.trim();
    let compared_number = if compared_number
        .get(..WHATSAPP_PREFIX.len())
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case(WHATSAPP_PREFIX))
    {
        &compared_number[WHATSAPP_PREFIX.len()..]
    } else {
        compared_number
    };
    matches_wildcard(
        &pattern.trim().to_ascii_lowercase(),
        &compared_number.to_ascii_lowercase(),
    )
}

/// A number like `+15559990000`, or digits with `*` for any digits (`+1555777*`).
pub fn is_valid_outcome_pattern(pattern: &str) -> bool {
    let pattern = pattern.trim();
    let digits = pattern.strip_prefix('+').unwrap_or(pattern);
    !digits.is_empty()
        && digits
            .chars()
            .all(|character| character.is_ascii_digit() || character == '*')
        && digits.chars().any(|character| character.is_ascii_digit())
}

/// Glob matching where `*` is the only special character.
fn matches_wildcard(pattern: &str, value: &str) -> bool {
    let mut pattern_parts = pattern.split('*');
    let Some(first_part) = pattern_parts.next() else {
        return value.is_empty();
    };
    let Some(mut remaining_value) = value.strip_prefix(first_part) else {
        return false;
    };
    let middle_and_last_parts: Vec<&str> = pattern_parts.collect();
    let Some((last_part, middle_parts)) = middle_and_last_parts.split_last() else {
        return remaining_value.is_empty();
    };
    for middle_part in middle_parts {
        match remaining_value.find(middle_part) {
            Some(found_at) => remaining_value = &remaining_value[found_at + middle_part.len()..],
            None => return false,
        }
    }
    remaining_value.ends_with(last_part)
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: SM-07.8
    #[test]
    fn a_star_matches_any_digits() {
        assert!(matches_outcome_pattern("+1555777*", "+15557770123"));
        assert!(matches_outcome_pattern("+1555777*", "+1555777"));
        assert!(matches_outcome_pattern("+1*99", "+1555000099"));
        assert!(!matches_outcome_pattern("+1555777*", "+15557780123"));
        assert!(!matches_outcome_pattern("+1*99", "+1555000098"));
    }

    #[test]
    fn an_exact_pattern_matches_only_that_number_with_or_without_whatsapp() {
        assert!(matches_outcome_pattern("+15559990000", "+15559990000"));
        assert!(matches_outcome_pattern(
            "+15559990000",
            "WhatsApp:+15559990000"
        ));
        assert!(!matches_outcome_pattern("+15559990000", "+155599900001"));
    }

    #[test]
    fn patterns_are_numbers_with_optional_stars() {
        assert!(is_valid_outcome_pattern("+1555777*"));
        assert!(is_valid_outcome_pattern("15559990000"));
        assert!(!is_valid_outcome_pattern("*"));
        assert!(!is_valid_outcome_pattern("+1-555"));
        assert!(!is_valid_outcome_pattern(""));
    }
}
