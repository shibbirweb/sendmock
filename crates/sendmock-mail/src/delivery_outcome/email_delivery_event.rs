/// Whether a bounce is permanent or a mailbox that may accept mail later.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BounceType {
    Hard,
    Soft,
}

impl BounceType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Hard => "hard",
            Self::Soft => "soft",
        }
    }
}

/// A simulated report from the receiving side, as a provider would send it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EmailDeliveryEvent {
    Delivered,
    Deferred,
    Bounced {
        bounce_type: BounceType,
        smtp_code: String,
        diagnostic: String,
    },
    Complained,
    Unsubscribed,
}

const HARD_BOUNCE_CODE: &str = "550 5.1.1";
const SOFT_BOUNCE_CODE: &str = "452 4.2.2";

impl EmailDeliveryEvent {
    /// The email's delivery status after this event, also the event name after `email.`.
    pub fn delivery_status(&self) -> &'static str {
        match self {
            Self::Delivered => "delivered",
            Self::Deferred => "deferred",
            Self::Bounced { .. } => "bounced",
            Self::Complained => "complained",
            Self::Unsubscribed => "unsubscribed",
        }
    }

    pub fn hard_bounce(diagnostic: &str) -> Self {
        Self::Bounced {
            bounce_type: BounceType::Hard,
            smtp_code: HARD_BOUNCE_CODE.to_owned(),
            diagnostic: diagnostic.to_owned(),
        }
    }

    pub fn soft_bounce() -> Self {
        Self::Bounced {
            bounce_type: BounceType::Soft,
            smtp_code: SOFT_BOUNCE_CODE.to_owned(),
            diagnostic: "mailbox full".to_owned(),
        }
    }

    /// A bounce of `bounce_type` with the usual code and text, as the Simulate action sends it.
    pub fn bounce_of_type(bounce_type: BounceType) -> Self {
        match bounce_type {
            BounceType::Hard => Self::hard_bounce("user unknown"),
            BounceType::Soft => Self::soft_bounce(),
        }
    }

    /// How the timeline describes it, e.g. `hard bounce, 550 5.1.1 user unknown`.
    pub fn describe(&self) -> String {
        match self {
            Self::Bounced {
                bounce_type,
                smtp_code,
                diagnostic,
            } => format!("{} bounce, {smtp_code} {diagnostic}", bounce_type.as_str()),
            other_event => other_event.delivery_status().to_owned(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_hard_bounce_names_its_code_and_reason() {
        let bounce = EmailDeliveryEvent::bounce_of_type(BounceType::Hard);

        assert_eq!(bounce.delivery_status(), "bounced");
        assert_eq!(bounce.describe(), "hard bounce, 550 5.1.1 user unknown");
    }

    #[test]
    fn other_events_are_described_by_their_status() {
        assert_eq!(EmailDeliveryEvent::Complained.describe(), "complained");
        assert_eq!(
            EmailDeliveryEvent::soft_bounce().describe(),
            "soft bounce, 452 4.2.2 mailbox full"
        );
    }
}
