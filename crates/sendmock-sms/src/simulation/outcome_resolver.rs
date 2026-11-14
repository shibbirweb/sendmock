use super::magic_numbers::{MagicNumber, find_magic_number};
use super::outcome_pattern::matches_outcome_pattern;
use super::sms_outcome::{MatchField, PlannedOutcome};

/// A custom outcome number as the resolver needs it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CustomOutcomeRule {
    pub rule_id: String,
    /// One-based; lower positions are checked first.
    pub position: u32,
    pub match_field: MatchField,
    pub pattern: String,
    pub planned_outcome: PlannedOutcome,
    pub is_enabled: bool,
}

/// What decides a number's outcome.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OutcomeSource<'rules> {
    Custom(&'rules CustomOutcomeRule),
    Magic(&'static MagicNumber),
    Profile,
}

impl OutcomeSource<'_> {
    pub fn planned_outcome(&self) -> Option<PlannedOutcome> {
        match self {
            Self::Custom(custom_rule) => Some(custom_rule.planned_outcome.clone()),
            Self::Magic(magic_number) => magic_number.planned_outcome(),
            Self::Profile => None,
        }
    }

    /// "Custom rule 2: Accepted, then undelivered, 30007", "Magic number: Invalid number
    /// (21211)" or the profile sentence, as "Test a number" shows it.
    pub fn describe(&self, profile_name: &str) -> String {
        match self {
            Self::Custom(custom_rule) => format!(
                "Custom rule {}: {}",
                custom_rule.position,
                custom_rule.planned_outcome.describe()
            ),
            Self::Magic(magic_number) => match magic_number.error_code {
                Some(error_code) => {
                    format!("Magic number: {} ({error_code})", magic_number.description)
                }
                None => format!("Magic number: {}", magic_number.description),
            },
            Self::Profile => {
                format!("No rule or magic number matches: the {profile_name} profile applies.")
            }
        }
    }
}

/// The first enabled custom rule that matches wins, then the magic numbers when they are on,
/// then the simulation profile.
pub fn resolve_number_outcome<'rules>(
    number: &str,
    match_field: MatchField,
    custom_rules: &'rules [CustomOutcomeRule],
    is_magic_numbers_enabled: bool,
) -> OutcomeSource<'rules> {
    let matching_rule = custom_rules
        .iter()
        .filter(|custom_rule| custom_rule.is_enabled && custom_rule.match_field == match_field)
        .filter(|custom_rule| matches_outcome_pattern(&custom_rule.pattern, number))
        .min_by_key(|custom_rule| custom_rule.position);
    if let Some(matching_rule) = matching_rule {
        return OutcomeSource::Custom(matching_rule);
    }
    if is_magic_numbers_enabled && let Some(magic_number) = find_magic_number(match_field, number) {
        return OutcomeSource::Magic(magic_number);
    }
    OutcomeSource::Profile
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::simulation::SmsOutcomeKind;

    fn custom_rule(position: u32, pattern: &str, error_code: &str) -> CustomOutcomeRule {
        CustomOutcomeRule {
            rule_id: format!("rule-{position}"),
            position,
            match_field: MatchField::To,
            pattern: pattern.to_owned(),
            planned_outcome: PlannedOutcome {
                kind: SmsOutcomeKind::Undelivered,
                error_code: Some(error_code.to_owned()),
                delay_seconds: None,
            },
            is_enabled: true,
        }
    }

    // AC: SM-07.8
    #[test]
    fn the_first_enabled_matching_rule_wins_over_magic_numbers() {
        let mut switched_off_rule = custom_rule(1, "+1500555*", "30001");
        switched_off_rule.is_enabled = false;
        let custom_rules = vec![
            custom_rule(3, "+15005550001", "30003"),
            switched_off_rule,
            custom_rule(2, "+150055500*", "30002"),
        ];

        let outcome_source =
            resolve_number_outcome("+15005550001", MatchField::To, &custom_rules, true);

        assert_eq!(
            outcome_source.describe("instant"),
            "Custom rule 2: Accepted, then undelivered, 30002"
        );
    }

    // AC: SM-07.9
    #[test]
    fn magic_numbers_apply_only_while_switched_on() {
        let switched_on = resolve_number_outcome("+15005550001", MatchField::To, &[], true);
        let switched_off = resolve_number_outcome("+15005550001", MatchField::To, &[], false);

        assert_eq!(
            switched_on.describe("instant"),
            "Magic number: Invalid number (21211)"
        );
        assert_eq!(switched_off, OutcomeSource::Profile);
        assert_eq!(
            switched_off.describe("realistic"),
            "No rule or magic number matches: the realistic profile applies."
        );
    }

    #[test]
    fn a_rule_only_matches_its_own_field() {
        let custom_rules = vec![custom_rule(1, "+15551230000", "30003")];

        let outcome_source =
            resolve_number_outcome("+15551230000", MatchField::From, &custom_rules, true);

        assert_eq!(outcome_source, OutcomeSource::Profile);
    }
}
