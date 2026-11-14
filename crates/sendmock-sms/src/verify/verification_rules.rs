use sendmock_core::RandomSource;

/// Wrong checks allowed before the verification fails with Twilio's `60202`.
pub const MAXIMUM_CHECK_ATTEMPTS: u32 = 5;
/// Sends allowed to one recipient before Twilio's `60203`.
pub const MAXIMUM_SEND_ATTEMPTS: u32 = 5;

/// The fixed code when the service has one, else `code_length` random digits.
pub fn generate_verification_code(
    code_length: u32,
    fixed_code: Option<&str>,
    random_source: &dyn RandomSource,
) -> String {
    if let Some(fixed_code) = fixed_code.filter(|fixed_code| !fixed_code.is_empty()) {
        return fixed_code.to_owned();
    }
    (0..code_length)
        .map(|_| char::from(b'0' + (random_source.next_u64() % 10) as u8))
        .collect()
}

/// Where a verification stands when a code is checked.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerificationProgress<'code> {
    pub status: &'code str,
    pub stored_code: &'code str,
    pub check_attempts: u32,
    pub expires_at_unix_ms: i64,
}

/// What a check does to a verification.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CheckOutcome {
    Approved,
    /// Still pending, with this many wrong checks so far.
    WrongCode {
        check_attempts: u32,
    },
    /// The wrong check that used the last attempt; the verification fails.
    MaxAttemptsReached,
    /// Expired at its deadline; Twilio answers `20404` as for an unknown one.
    Expired,
    /// Approved, canceled or failed before; Twilio answers `20404`.
    NotPending,
}

/// Checks a code as Twilio Verify does: only a pending, unexpired verification can be
/// approved, and the fifth wrong code ends it.
pub fn check_verification_code(
    progress: &VerificationProgress<'_>,
    given_code: &str,
    now_unix_ms: i64,
) -> CheckOutcome {
    if progress.status != "pending" {
        return CheckOutcome::NotPending;
    }
    if now_unix_ms >= progress.expires_at_unix_ms {
        return CheckOutcome::Expired;
    }
    if given_code.trim() == progress.stored_code {
        return CheckOutcome::Approved;
    }
    let check_attempts = progress.check_attempts + 1;
    if check_attempts >= MAXIMUM_CHECK_ATTEMPTS {
        CheckOutcome::MaxAttemptsReached
    } else {
        CheckOutcome::WrongCode { check_attempts }
    }
}

#[cfg(test)]
mod tests {
    use sendmock_core::SeededRandomSource;

    use super::*;

    fn pending(check_attempts: u32) -> VerificationProgress<'static> {
        VerificationProgress {
            status: "pending",
            stored_code: "482913",
            check_attempts,
            expires_at_unix_ms: 10_000,
        }
    }

    // AC: VF-02.3
    #[test]
    fn a_fixed_code_is_always_used_and_random_codes_have_the_length() {
        let random_source = SeededRandomSource::new(3);

        assert_eq!(
            generate_verification_code(6, Some("123456"), &random_source),
            "123456"
        );
        let random_code = generate_verification_code(8, None, &random_source);
        assert_eq!(random_code.len(), 8);
        assert!(
            random_code
                .chars()
                .all(|character| character.is_ascii_digit())
        );
    }

    // AC: VF-03.1
    #[test]
    fn the_right_code_approves_and_a_wrong_one_stays_pending() {
        assert_eq!(
            check_verification_code(&pending(0), " 482913 ", 1_000),
            CheckOutcome::Approved
        );
        assert_eq!(
            check_verification_code(&pending(0), "000000", 1_000),
            CheckOutcome::WrongCode { check_attempts: 1 }
        );
    }

    // AC: VF-03.2
    #[test]
    fn the_fifth_wrong_code_ends_the_verification() {
        assert_eq!(
            check_verification_code(&pending(MAXIMUM_CHECK_ATTEMPTS - 1), "000000", 1_000),
            CheckOutcome::MaxAttemptsReached
        );
    }

    // AC: VF-03.3
    #[test]
    fn expired_and_finished_verifications_cannot_be_checked() {
        let mut approved = pending(0);
        approved.status = "approved";

        assert_eq!(
            check_verification_code(&pending(0), "482913", 10_000),
            CheckOutcome::Expired
        );
        assert_eq!(
            check_verification_code(&approved, "482913", 1_000),
            CheckOutcome::NotPending
        );
    }
}
