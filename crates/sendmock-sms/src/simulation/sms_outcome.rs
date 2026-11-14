/// What a custom outcome number or magic number does to a message.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SmsOutcomeKind {
    /// Refused on send with the error code.
    Reject,
    Undelivered,
    Failed,
    DelayedDelivery,
    /// Delivered, then read, as WhatsApp and RCS report.
    Read,
}

impl SmsOutcomeKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Reject => "reject",
            Self::Undelivered => "undelivered",
            Self::Failed => "failed",
            Self::DelayedDelivery => "delayed_delivery",
            Self::Read => "read",
        }
    }

    pub fn parse(outcome_name: &str) -> Option<Self> {
        match outcome_name {
            "reject" => Some(Self::Reject),
            "undelivered" => Some(Self::Undelivered),
            "failed" => Some(Self::Failed),
            "delayed_delivery" => Some(Self::DelayedDelivery),
            "read" => Some(Self::Read),
            _ => None,
        }
    }

    /// Reject, undelivered and failed report an error code; the others never do.
    pub fn requires_error_code(self) -> bool {
        matches!(self, Self::Reject | Self::Undelivered | Self::Failed)
    }

    /// The label the Settings list and the outcome tester show.
    pub fn label(self) -> &'static str {
        match self {
            Self::Reject => "Reject on send",
            Self::Undelivered => "Accepted, then undelivered",
            Self::Failed => "Accepted, then failed",
            Self::DelayedDelivery => "Delivered after a delay",
            Self::Read => "Delivered, then read",
        }
    }
}

/// Whether a rule looks at the message's recipient or its sender.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MatchField {
    To,
    From,
}

impl MatchField {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::To => "to",
            Self::From => "from",
        }
    }

    pub fn parse(field_name: &str) -> Option<Self> {
        match field_name {
            "to" => Some(Self::To),
            "from" => Some(Self::From),
            _ => None,
        }
    }
}

/// An outcome with its error code or delay, as a rule or magic number decides it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedOutcome {
    pub kind: SmsOutcomeKind,
    pub error_code: Option<String>,
    pub delay_seconds: Option<u32>,
}

impl PlannedOutcome {
    /// "Accepted, then undelivered, 30007" or "Delivered after 10 s", as the rule list shows it.
    pub fn describe(&self) -> String {
        match self.kind {
            SmsOutcomeKind::DelayedDelivery => {
                format!(
                    "Delivered after {} s",
                    self.delay_seconds.unwrap_or_default()
                )
            }
            SmsOutcomeKind::Read => self.kind.label().to_owned(),
            _ => format!(
                "{}, {}",
                self.kind.label(),
                self.error_code.as_deref().unwrap_or_default()
            ),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn describes_each_outcome_like_the_settings_list() {
        let undelivered = PlannedOutcome {
            kind: SmsOutcomeKind::Undelivered,
            error_code: Some("30007".to_owned()),
            delay_seconds: None,
        };
        let delayed = PlannedOutcome {
            kind: SmsOutcomeKind::DelayedDelivery,
            error_code: None,
            delay_seconds: Some(10),
        };

        assert_eq!(undelivered.describe(), "Accepted, then undelivered, 30007");
        assert_eq!(delayed.describe(), "Delivered after 10 s");
    }

    #[test]
    fn outcome_names_round_trip() {
        for outcome_kind in [
            SmsOutcomeKind::Reject,
            SmsOutcomeKind::Undelivered,
            SmsOutcomeKind::Failed,
            SmsOutcomeKind::DelayedDelivery,
            SmsOutcomeKind::Read,
        ] {
            assert_eq!(
                SmsOutcomeKind::parse(outcome_kind.as_str()),
                Some(outcome_kind)
            );
        }
        assert_eq!(SmsOutcomeKind::parse("bounce"), None);
    }
}
