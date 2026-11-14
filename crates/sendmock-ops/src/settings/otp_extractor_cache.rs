use std::sync::{Arc, Mutex, PoisonError};

use sendmock_mail::OtpExtractor;

/// The OTP patterns from Settings, compiled once and reused for every message until the
/// patterns change. Compiling them per message cost more than storing the message, and on
/// musl the allocations it made held SMTP ingest under its budget.
#[derive(Clone, Default)]
pub struct OtpExtractorCache {
    compiled_patterns: Arc<Mutex<Option<CompiledOtpPatterns>>>,
}

struct CompiledOtpPatterns {
    pattern_texts: Vec<String>,
    otp_extractor: OtpExtractor,
}

impl OtpExtractorCache {
    /// The extractor for these patterns: the cached one when they are the patterns it was
    /// compiled from, else a fresh compilation that replaces it.
    pub fn otp_extractor_for(&self, pattern_texts: &[String]) -> OtpExtractor {
        let mut compiled_patterns = self
            .compiled_patterns
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        if let Some(cached) = compiled_patterns.as_ref()
            && cached.pattern_texts == pattern_texts
        {
            return cached.otp_extractor.clone();
        }
        let otp_extractor = compile_otp_extractor(pattern_texts);
        *compiled_patterns = Some(CompiledOtpPatterns {
            pattern_texts: pattern_texts.to_vec(),
            otp_extractor: otp_extractor.clone(),
        });
        otp_extractor
    }
}

/// The patterns from Settings, or the defaults when one of them does not compile.
pub fn compile_otp_extractor(pattern_texts: &[String]) -> OtpExtractor {
    let pattern_text_slices: Vec<&str> = pattern_texts.iter().map(String::as_str).collect();
    OtpExtractor::with_patterns(&pattern_text_slices)
        .unwrap_or_else(|_| OtpExtractor::with_default_patterns())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn patterns(pattern_texts: &[&str]) -> Vec<String> {
        pattern_texts
            .iter()
            .map(|pattern_text| (*pattern_text).to_owned())
            .collect()
    }

    // AC: EM-05.3
    #[test]
    fn the_cached_extractor_finds_codes_with_the_settings_patterns() {
        let otp_extractor_cache = OtpExtractorCache::default();
        let custom_patterns = patterns(&[r"REF-(\d{6})"]);

        let first_extractor = otp_extractor_cache.otp_extractor_for(&custom_patterns);
        let second_extractor = otp_extractor_cache.otp_extractor_for(&custom_patterns);

        assert_eq!(
            first_extractor.extract_codes("Order REF-123456"),
            vec!["123456"]
        );
        assert_eq!(
            second_extractor.extract_codes("Order REF-654321"),
            vec!["654321"]
        );
    }

    // AC: EM-05.3
    #[test]
    fn changed_patterns_replace_the_cached_extractor() {
        let otp_extractor_cache = OtpExtractorCache::default();
        otp_extractor_cache.otp_extractor_for(&patterns(&[r"REF-(\d{6})"]));

        let changed_extractor = otp_extractor_cache.otp_extractor_for(&patterns(&[r"PIN (\d{4})"]));

        assert_eq!(
            changed_extractor.extract_codes("PIN 4821, REF-123456"),
            vec!["4821"]
        );
    }

    #[test]
    fn a_pattern_that_does_not_compile_falls_back_to_the_defaults() {
        let otp_extractor_cache = OtpExtractorCache::default();

        let fallback_extractor = otp_extractor_cache.otp_extractor_for(&patterns(&["(unclosed"]));

        assert_eq!(
            fallback_extractor.extract_codes("Your verification code is 482913."),
            vec!["482913"]
        );
    }
}
