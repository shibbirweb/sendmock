mod verification_rules;

pub use verification_rules::{
    CheckOutcome, MAXIMUM_CHECK_ATTEMPTS, MAXIMUM_SEND_ATTEMPTS, VerificationProgress,
    check_verification_code, generate_verification_code,
};
