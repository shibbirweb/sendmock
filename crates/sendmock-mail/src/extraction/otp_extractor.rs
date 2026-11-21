use std::sync::Arc;

use regex::Regex;

/// 4 to 8 digit codes next to the words people use for them, before or after. After a code,
/// up to three words may name what it is for, as in "909582 is your App login code".
pub const DEFAULT_OTP_PATTERNS: [&str; 2] = [
    r"(?i)(?:code|otp|verification|passcode|pin|one[- ]time)[^0-9\n]{0,40}?\b(\d{4,8})\b",
    r"(?i)\b(\d{4,8})\b[^0-9\n]{0,20}?is your (?:[^\s0-9]+[ \t]+){0,3}?(?:code|otp|verification|passcode|pin)\b",
];

/// Finds one-time codes with the default patterns, or the custom ones from Settings. A
/// pattern's first capture group is the code; without one, the whole match is. Clones share
/// the compiled patterns and their search caches, since compiling them is far dearer than
/// running them.
#[derive(Debug, Clone)]
pub struct OtpExtractor {
    patterns: Arc<[Regex]>,
}

impl OtpExtractor {
    pub fn with_default_patterns() -> Self {
        Self::with_patterns(&DEFAULT_OTP_PATTERNS).unwrap_or(Self {
            patterns: Arc::from([]),
        })
    }

    /// Fails on the first pattern that is not a valid regular expression.
    pub fn with_patterns(pattern_texts: &[&str]) -> Result<Self, regex::Error> {
        let patterns = pattern_texts
            .iter()
            .map(|pattern_text| Regex::new(pattern_text))
            .collect::<Result<Vec<_>, _>>()?;
        Ok(Self {
            patterns: Arc::from(patterns),
        })
    }

    /// Every code found, first seen first, without repeats.
    pub fn extract_codes(&self, message_text: &str) -> Vec<String> {
        let mut codes: Vec<String> = Vec::new();
        for pattern in self.patterns.iter() {
            for code_match in pattern.captures_iter(message_text) {
                let code = code_match
                    .get(1)
                    .or_else(|| code_match.get(0))
                    .map(|matched| matched.as_str().to_owned());
                if let Some(code) = code.filter(|code| !codes.contains(code)) {
                    codes.push(code);
                }
            }
        }
        codes
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: EM-05.1
    #[test]
    fn finds_codes_near_the_words_for_them() {
        let otp_extractor = OtpExtractor::with_default_patterns();

        assert_eq!(
            otp_extractor.extract_codes("Your verification code is 482913."),
            ["482913"]
        );
        assert_eq!(otp_extractor.extract_codes("OTP: 1234"), ["1234"]);
        assert_eq!(
            otp_extractor.extract_codes("90817262 is your code for Acme"),
            ["90817262"]
        );
    }

    // AC: EM-05.1
    #[test]
    fn ignores_numbers_that_are_not_codes() {
        let otp_extractor = OtpExtractor::with_default_patterns();

        assert!(
            otp_extractor
                .extract_codes("Order 1042 shipped on 2026-10-29.")
                .is_empty()
        );
        assert!(otp_extractor.extract_codes("Your code is 123.").is_empty());
    }

    // AC: EM-05.6
    #[test]
    fn finds_a_code_named_with_up_to_three_words_after_is_your() {
        let otp_extractor = OtpExtractor::with_default_patterns();

        assert_eq!(
            otp_extractor.extract_codes("909582 is your App login code"),
            ["909582"]
        );
        assert_eq!(
            otp_extractor.extract_codes("4821 is your Acme Bank sign-in PIN."),
            ["4821"]
        );
        assert_eq!(
            otp_extractor.extract_codes("123456 is your one-time verification"),
            ["123456"]
        );
    }

    // AC: EM-05.6
    #[test]
    fn a_number_followed_by_other_words_is_still_not_a_code() {
        let otp_extractor = OtpExtractor::with_default_patterns();

        assert!(
            otp_extractor
                .extract_codes("1042 is your order number")
                .is_empty()
        );
        assert!(
            otp_extractor
                .extract_codes("5551 is your seat on the coach for the codebase tour")
                .is_empty()
        );
        assert!(
            otp_extractor
                .extract_codes("2026 is your year\ncode words follow later")
                .is_empty()
        );
    }

    // AC: EM-05.3
    #[test]
    fn uses_custom_patterns_instead() -> Result<(), regex::Error> {
        let otp_extractor = OtpExtractor::with_patterns(&[r"REF-([A-Z0-9]{6})"])?;

        assert_eq!(
            otp_extractor.extract_codes("Use REF-AB12CD to sign in"),
            ["AB12CD"]
        );
        Ok(())
    }

    #[test]
    fn refuses_an_invalid_pattern() {
        assert!(OtpExtractor::with_patterns(&["(unclosed"]).is_err());
    }
}
