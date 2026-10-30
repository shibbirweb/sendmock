use super::{EmailOutcome, EmailOutcomeRule, find_magic_address_outcome};

/// What decides an address's outcome.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AddressOutcomeSource<'rules> {
    CustomRule(&'rules EmailOutcomeRule),
    MagicAddress(EmailOutcome),
    Profile,
}

impl AddressOutcomeSource<'_> {
    /// "Custom rule 2: Hard bounce, 550 5.1.1", "Magic address: Hard bounce (550 5.1.1)" or the
    /// profile sentence, as "Test an address" shows it.
    pub fn describe(&self, profile_name: &str) -> String {
        match self {
            Self::CustomRule(custom_rule) => {
                format!(
                    "Custom rule {}: {}",
                    custom_rule.position,
                    custom_rule.describe()
                )
            }
            Self::MagicAddress(email_outcome) => {
                format!("Magic address: {}", describe_magic_outcome(*email_outcome))
            }
            Self::Profile => format!(
                "No rule or magic address matches: the {profile_name} outcome profile applies."
            ),
        }
    }
}

/// The wording of the magic address table in Settings.
fn describe_magic_outcome(email_outcome: EmailOutcome) -> &'static str {
    match email_outcome {
        EmailOutcome::Delivered => "email.delivered",
        EmailOutcome::HardBounce => "Hard bounce (550 5.1.1)",
        EmailOutcome::SoftBounce => "email.deferred, then soft bounce",
        EmailOutcome::Complaint => "Delivered, then email.complained",
        EmailOutcome::Unsubscribe => "email.unsubscribed",
        EmailOutcome::OutOfOffice => "Delivered, then an out-of-office reply",
        EmailOutcome::SuppressionList => "Bounce with a suppression-list reason",
    }
}

/// The first enabled custom rule that matches wins, then the magic addresses when they are
/// on, then the delivery profile.
pub fn resolve_address_outcome<'rules>(
    recipient_address: &str,
    custom_rules: &'rules [EmailOutcomeRule],
    is_magic_addresses_enabled: bool,
) -> AddressOutcomeSource<'rules> {
    let matching_rule = custom_rules
        .iter()
        .filter(|custom_rule| custom_rule.is_enabled)
        .filter(|custom_rule| custom_rule.matches_address(recipient_address))
        .min_by_key(|custom_rule| custom_rule.position);
    if let Some(matching_rule) = matching_rule {
        return AddressOutcomeSource::CustomRule(matching_rule);
    }
    if is_magic_addresses_enabled
        && let Some(email_outcome) = find_magic_address_outcome(recipient_address)
    {
        return AddressOutcomeSource::MagicAddress(email_outcome);
    }
    AddressOutcomeSource::Profile
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::EmailRuleOutcome;

    fn custom_rule(position: u32, pattern: &str, outcome: EmailRuleOutcome) -> EmailOutcomeRule {
        EmailOutcomeRule {
            rule_id: format!("rule-{position}"),
            position,
            pattern: pattern.to_owned(),
            outcome,
            smtp_code: None,
            diagnostic: None,
            is_enabled: true,
        }
    }

    // AC: EM-10.5
    #[test]
    fn the_first_enabled_matching_rule_wins_over_magic_addresses() {
        let mut switched_off_rule = custom_rule(1, "bounce@*", EmailRuleOutcome::Reject);
        switched_off_rule.is_enabled = false;
        let custom_rules = vec![
            custom_rule(3, "*@shop.test", EmailRuleOutcome::Complaint),
            switched_off_rule,
            custom_rule(2, "bounce@shop.test", EmailRuleOutcome::Delivered),
        ];

        let outcome_source = resolve_address_outcome("Bounce@Shop.test", &custom_rules, true);

        assert_eq!(outcome_source.describe("off"), "Custom rule 2: Delivered");
    }

    // AC: EM-10.6
    #[test]
    fn magic_addresses_apply_only_while_switched_on() {
        let switched_on = resolve_address_outcome("bounce@shop.test", &[], true);
        let switched_off = resolve_address_outcome("bounce@shop.test", &[], false);

        assert_eq!(
            switched_on.describe("off"),
            "Magic address: Hard bounce (550 5.1.1)"
        );
        assert_eq!(switched_off, AddressOutcomeSource::Profile);
        assert_eq!(
            switched_off.describe("realistic"),
            "No rule or magic address matches: the realistic outcome profile applies."
        );
    }
}
