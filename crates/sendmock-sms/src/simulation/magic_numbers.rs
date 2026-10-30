use super::sms_outcome::{MatchField, PlannedOutcome, SmsOutcomeKind};

/// A built-in test number with a fixed outcome; `outcome` is `None` for a number that passes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MagicNumber {
    pub number: &'static str,
    pub description: &'static str,
    pub outcome: Option<SmsOutcomeKind>,
    pub error_code: Option<&'static str>,
    pub delay_seconds: Option<u32>,
}

impl MagicNumber {
    const fn rejected(
        number: &'static str,
        description: &'static str,
        error_code: &'static str,
    ) -> Self {
        Self {
            number,
            description,
            outcome: Some(SmsOutcomeKind::Reject),
            error_code: Some(error_code),
            delay_seconds: None,
        }
    }

    const fn after_send(
        number: &'static str,
        description: &'static str,
        outcome: SmsOutcomeKind,
        error_code: Option<&'static str>,
    ) -> Self {
        Self {
            number,
            description,
            outcome: Some(outcome),
            error_code,
            delay_seconds: None,
        }
    }

    pub fn planned_outcome(&self) -> Option<PlannedOutcome> {
        self.outcome.map(|outcome_kind| PlannedOutcome {
            kind: outcome_kind,
            error_code: self.error_code.map(str::to_owned),
            delay_seconds: self.delay_seconds,
        })
    }
}

/// Twilio's test `To` numbers, refused on send with Twilio's error codes.
static TWILIO_TO_NUMBERS: [MagicNumber; 5] = [
    MagicNumber::rejected("+15005550001", "Invalid number", "21211"),
    MagicNumber::rejected("+15005550002", "Cannot route to this number", "21612"),
    MagicNumber::rejected("+15005550003", "No international permissions", "21408"),
    MagicNumber::rejected("+15005550004", "Number is blocked (opted out)", "21610"),
    MagicNumber::rejected("+15005550009", "Number cannot receive SMS", "21614"),
];

/// SendMock's after-send numbers; Twilio's test mode has none because it never calls back.
static SENDMOCK_AFTER_SEND_NUMBERS: [MagicNumber; 6] = [
    MagicNumber::after_send(
        "+15005550101",
        "Accepted, then undelivered (unreachable handset)",
        SmsOutcomeKind::Undelivered,
        Some("30003"),
    ),
    MagicNumber::after_send(
        "+15005550102",
        "Accepted, then undelivered (landline or unreachable carrier)",
        SmsOutcomeKind::Undelivered,
        Some("30006"),
    ),
    MagicNumber::after_send(
        "+15005550103",
        "Accepted, then undelivered (filtered by carrier)",
        SmsOutcomeKind::Undelivered,
        Some("30007"),
    ),
    MagicNumber::after_send(
        "+15005550104",
        "Accepted, then failed (unknown error)",
        SmsOutcomeKind::Failed,
        Some("30008"),
    ),
    MagicNumber {
        number: "+15005550105",
        description: "Accepted, delivered after 30 s",
        outcome: Some(SmsOutcomeKind::DelayedDelivery),
        error_code: None,
        delay_seconds: Some(30),
    },
    MagicNumber::after_send(
        "+15005550106",
        "Accepted, delivered, then read",
        SmsOutcomeKind::Read,
        None,
    ),
];

/// Twilio's test `From` numbers.
static TWILIO_FROM_NUMBERS: [MagicNumber; 4] = [
    MagicNumber::rejected("+15005550001", "Invalid From", "21212"),
    MagicNumber {
        number: "+15005550006",
        description: "Valid, passes",
        outcome: None,
        error_code: None,
        delay_seconds: None,
    },
    MagicNumber::rejected("+15005550007", "Not owned or not SMS-capable", "21606"),
    MagicNumber::rejected("+15005550008", "Message queue full", "21611"),
];

/// The magic number a recipient or sender is, ignoring a `whatsapp:` prefix.
pub fn find_magic_number(match_field: MatchField, number: &str) -> Option<&'static MagicNumber> {
    let compared_number = strip_whatsapp_prefix(number.trim());
    let magic_number_tables: &[&'static [MagicNumber]] = match match_field {
        MatchField::To => &[&TWILIO_TO_NUMBERS, &SENDMOCK_AFTER_SEND_NUMBERS],
        MatchField::From => &[&TWILIO_FROM_NUMBERS],
    };
    magic_number_tables
        .iter()
        .flat_map(|magic_number_table| magic_number_table.iter())
        .find(|magic_number| magic_number.number == compared_number)
}

/// Real test credentials accept only Twilio's test `From` numbers.
pub fn is_twilio_test_from_number(number: &str) -> bool {
    find_magic_number(MatchField::From, number).is_some()
}

/// What a test-number error code means, as the magic number tables describe it.
pub fn describe_error_code(error_code: &str) -> Option<&'static str> {
    TWILIO_TO_NUMBERS
        .iter()
        .chain(&TWILIO_FROM_NUMBERS)
        .chain(&SENDMOCK_AFTER_SEND_NUMBERS)
        .find(|magic_number| magic_number.error_code == Some(error_code))
        .map(|magic_number| magic_number.description)
}

/// The outcome name a provider definition maps to its own error code, for each Twilio code
/// the simulation uses.
pub fn outcome_name_for_error_code(error_code: &str) -> Option<&'static str> {
    match error_code {
        "21211" => Some("invalid_number"),
        "21612" => Some("cannot_route"),
        "21408" => Some("no_international_permission"),
        "21610" => Some("blocked"),
        "21614" => Some("cannot_receive_sms"),
        "21212" => Some("invalid_from"),
        "21606" => Some("not_sms_capable"),
        "21611" => Some("queue_full"),
        "30003" => Some("unreachable_handset"),
        "30006" => Some("landline"),
        "30007" => Some("carrier_filtered"),
        "30008" => Some("unknown_error"),
        _ => None,
    }
}

fn strip_whatsapp_prefix(number: &str) -> &str {
    number
        .strip_prefix("whatsapp:")
        .or_else(|| number.strip_prefix("WhatsApp:"))
        .unwrap_or(number)
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: SM-07.2
    #[test]
    fn twilio_to_numbers_carry_twilio_error_codes() {
        let expected_codes = [
            ("+15005550001", "21211"),
            ("+15005550002", "21612"),
            ("+15005550003", "21408"),
            ("+15005550004", "21610"),
            ("+15005550009", "21614"),
        ];
        for (number, error_code) in expected_codes {
            let magic_number = find_magic_number(MatchField::To, number);
            assert_eq!(
                magic_number.and_then(|found| found.outcome),
                Some(SmsOutcomeKind::Reject)
            );
            assert_eq!(
                magic_number.and_then(|found| found.error_code),
                Some(error_code)
            );
        }
    }

    // AC: SM-07.2
    #[test]
    fn twilio_from_numbers_carry_twilio_error_codes() {
        assert_eq!(
            find_magic_number(MatchField::From, "+15005550001").and_then(|found| found.error_code),
            Some("21212")
        );
        assert_eq!(
            find_magic_number(MatchField::From, "+15005550006").and_then(|found| found.outcome),
            None
        );
        assert_eq!(
            find_magic_number(MatchField::From, "+15005550007").and_then(|found| found.error_code),
            Some("21606")
        );
        assert_eq!(
            find_magic_number(MatchField::From, "+15005550008").and_then(|found| found.error_code),
            Some("21611")
        );
    }

    // AC: SM-07.3
    #[test]
    fn after_send_numbers_plan_their_documented_outcome() {
        let planned = |number: &str| {
            find_magic_number(MatchField::To, number).and_then(MagicNumber::planned_outcome)
        };

        assert_eq!(
            planned("+15005550103").map(|outcome| (outcome.kind, outcome.error_code)),
            Some((SmsOutcomeKind::Undelivered, Some("30007".to_owned())))
        );
        assert_eq!(
            planned("+15005550104").map(|outcome| (outcome.kind, outcome.error_code)),
            Some((SmsOutcomeKind::Failed, Some("30008".to_owned())))
        );
        assert_eq!(
            planned("+15005550105").and_then(|outcome| outcome.delay_seconds),
            Some(30)
        );
        assert_eq!(
            planned("whatsapp:+15005550106").map(|outcome| outcome.kind),
            Some(SmsOutcomeKind::Read)
        );
    }

    #[test]
    fn after_send_numbers_are_not_sender_numbers() {
        assert!(find_magic_number(MatchField::From, "+15005550101").is_none());
        assert!(!is_twilio_test_from_number("+15551234567"));
        assert!(is_twilio_test_from_number("+15005550006"));
    }
}
