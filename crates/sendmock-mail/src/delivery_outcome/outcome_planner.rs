use sendmock_core::RandomSource;

use super::{EmailOutcome, OutcomeStep, find_magic_address_outcome};

/// How long the delivery profile waits before its first report.
pub const PROFILE_DELAY_MS: u64 = 1_000;

/// The delivery profile from Settings, for emails no magic address decides.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeliveryProfile {
    Off,
    AutoDelivered,
    /// Bounces and complaints at these rates (0 to 100), the rest delivered.
    Realistic {
        bounce_rate_percent: u32,
        complaint_rate_percent: u32,
    },
}

/// What decided an outcome, as the timeline names it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutcomeSource {
    MagicAddress,
    DeliveryProfile,
}

impl OutcomeSource {
    pub fn label(self) -> &'static str {
        match self {
            Self::MagicAddress => "magic address",
            Self::DeliveryProfile => "delivery profile",
        }
    }
}

/// The outcome chosen for one sent email and the steps that play it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PlannedOutcome {
    pub outcome: EmailOutcome,
    pub recipient_address: String,
    pub source: OutcomeSource,
    pub steps: Vec<OutcomeStep>,
}

/// Inputs from Settings that decide a sent email's outcome.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct OutcomeSettings {
    pub is_magic_addresses_enabled: bool,
    pub delivery_profile: DeliveryProfile,
}

/// The first recipient that is a magic address decides at once; otherwise the profile
/// decides for the first recipient after a short delay; none when the profile is off.
pub fn plan_email_outcome(
    recipient_addresses: &[String],
    outcome_settings: OutcomeSettings,
    random_source: &dyn RandomSource,
) -> Option<PlannedOutcome> {
    let magic_match = outcome_settings
        .is_magic_addresses_enabled
        .then(|| {
            recipient_addresses.iter().find_map(|recipient_address| {
                find_magic_address_outcome(recipient_address)
                    .map(|email_outcome| (recipient_address, email_outcome))
            })
        })
        .flatten();
    if let Some((recipient_address, email_outcome)) = magic_match {
        return Some(PlannedOutcome {
            outcome: email_outcome,
            recipient_address: recipient_address.clone(),
            source: OutcomeSource::MagicAddress,
            steps: email_outcome.plan_steps(0),
        });
    }
    let first_recipient = recipient_addresses.first()?;
    let email_outcome = choose_profile_outcome(outcome_settings.delivery_profile, random_source)?;
    Some(PlannedOutcome {
        outcome: email_outcome,
        recipient_address: first_recipient.clone(),
        source: OutcomeSource::DeliveryProfile,
        steps: email_outcome.plan_steps(PROFILE_DELAY_MS),
    })
}

fn choose_profile_outcome(
    delivery_profile: DeliveryProfile,
    random_source: &dyn RandomSource,
) -> Option<EmailOutcome> {
    match delivery_profile {
        DeliveryProfile::Off => None,
        DeliveryProfile::AutoDelivered => Some(EmailOutcome::Delivered),
        DeliveryProfile::Realistic {
            bounce_rate_percent,
            complaint_rate_percent,
        } => {
            let roll = random_source.next_u64() % 100;
            let bounce_limit = u64::from(bounce_rate_percent.min(100));
            let complaint_limit = bounce_limit + u64::from(complaint_rate_percent.min(100));
            Some(if roll < bounce_limit {
                EmailOutcome::HardBounce
            } else if roll < complaint_limit {
                EmailOutcome::Complaint
            } else {
                EmailOutcome::Delivered
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct FixedRoll(u64);

    impl RandomSource for FixedRoll {
        fn next_u64(&self) -> u64 {
            self.0
        }
    }

    fn recipients(addresses: &[&str]) -> Vec<String> {
        addresses
            .iter()
            .map(|address| (*address).to_owned())
            .collect()
    }

    fn settings(
        is_magic_addresses_enabled: bool,
        delivery_profile: DeliveryProfile,
    ) -> OutcomeSettings {
        OutcomeSettings {
            is_magic_addresses_enabled,
            delivery_profile,
        }
    }

    const REALISTIC: DeliveryProfile = DeliveryProfile::Realistic {
        bounce_rate_percent: 10,
        complaint_rate_percent: 5,
    };

    #[test]
    fn the_first_magic_recipient_decides_at_once() {
        let planned = plan_email_outcome(
            &recipients(&["sam@shop.test", "bounce@shop.test"]),
            settings(true, DeliveryProfile::AutoDelivered),
            &FixedRoll(0),
        );

        let planned = planned.unwrap_or_else(|| panic!("a magic address decides"));
        assert_eq!(planned.outcome, EmailOutcome::HardBounce);
        assert_eq!(planned.recipient_address, "bounce@shop.test");
        assert_eq!(planned.source, OutcomeSource::MagicAddress);
        assert_eq!(planned.steps[0].after_ms, 0);
    }

    #[test]
    fn with_magic_addresses_off_the_profile_decides() {
        let planned = plan_email_outcome(
            &recipients(&["bounce@shop.test"]),
            settings(false, DeliveryProfile::AutoDelivered),
            &FixedRoll(0),
        );

        let planned = planned.unwrap_or_else(|| panic!("the profile decides"));
        assert_eq!(planned.outcome, EmailOutcome::Delivered);
        assert_eq!(planned.source, OutcomeSource::DeliveryProfile);
        assert_eq!(planned.steps[0].after_ms, PROFILE_DELAY_MS);
    }

    #[test]
    fn the_off_profile_plans_nothing_for_ordinary_addresses() {
        let planned = plan_email_outcome(
            &recipients(&["sam@shop.test"]),
            settings(true, DeliveryProfile::Off),
            &FixedRoll(0),
        );

        assert_eq!(planned, None);
    }

    #[test]
    fn the_realistic_profile_bounces_complains_or_delivers_by_its_rates() {
        let outcome_for_roll = |roll: u64| {
            plan_email_outcome(
                &recipients(&["sam@shop.test"]),
                settings(true, REALISTIC),
                &FixedRoll(roll),
            )
            .map(|planned| planned.outcome)
        };

        assert_eq!(outcome_for_roll(9), Some(EmailOutcome::HardBounce));
        assert_eq!(outcome_for_roll(10), Some(EmailOutcome::Complaint));
        assert_eq!(outcome_for_roll(14), Some(EmailOutcome::Complaint));
        assert_eq!(outcome_for_roll(115), Some(EmailOutcome::Delivered));
    }
}
