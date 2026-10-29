use regex::{Regex, RegexBuilder};

/// How a condition compares one field value; text operators ignore case, `regex` does not.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuleOperator {
    Equals,
    Contains,
    StartsWith,
    /// A glob over the whole value: `*` any run, `?` one character.
    Matches,
    Regex,
    /// The field has a non-empty value.
    Exists,
}

impl RuleOperator {
    pub fn needs_value(self) -> bool {
        self != Self::Exists
    }

    /// Whether one field value satisfies the condition value.
    pub fn test_value(self, field_value: &str, condition_value: &str) -> bool {
        let lowercase_field = field_value.to_lowercase();
        let lowercase_condition = condition_value.to_lowercase();
        match self {
            Self::Equals => lowercase_field == lowercase_condition,
            Self::Contains => lowercase_field.contains(&lowercase_condition),
            Self::StartsWith => lowercase_field.starts_with(&lowercase_condition),
            Self::Matches => build_glob_regex(condition_value)
                .is_some_and(|glob_regex| glob_regex.is_match(field_value)),
            Self::Regex => Regex::new(condition_value)
                .is_ok_and(|value_regex| value_regex.is_match(field_value)),
            Self::Exists => !field_value.is_empty(),
        }
    }
}

/// `*@support.local` style globs as an anchored, case-insensitive regex.
fn build_glob_regex(glob_pattern: &str) -> Option<Regex> {
    let regex_source: String = glob_pattern
        .chars()
        .map(|pattern_character| match pattern_character {
            '*' => ".*".to_owned(),
            '?' => ".".to_owned(),
            literal_character => regex::escape(&literal_character.to_string()),
        })
        .collect();
    RegexBuilder::new(&format!("^{regex_source}$"))
        .case_insensitive(true)
        .build()
        .ok()
}

/// Null for a valid regex, else the reason.
pub fn read_regex_error(regex_source: &str) -> Option<String> {
    Regex::new(regex_source)
        .err()
        .map(|regex_error| regex_error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: WH-02.2
    #[test]
    fn text_operators_ignore_case() {
        assert!(RuleOperator::Equals.test_value("Support@App.test", "support@app.test"));
        assert!(RuleOperator::Contains.test_value("Ticket #42 opened", "TICKET"));
        assert!(RuleOperator::StartsWith.test_value("+15551234567", "+1555"));
        assert!(!RuleOperator::StartsWith.test_value("+44 20", "+1"));
    }

    // AC: WH-02.2
    #[test]
    fn globs_match_the_whole_value() {
        assert!(RuleOperator::Matches.test_value("help@Support.local", "*@support.local"));
        assert!(RuleOperator::Matches.test_value("a1", "a?"));
        assert!(!RuleOperator::Matches.test_value("help@support.local.evil", "*@support.local"));
        assert!(RuleOperator::Matches.test_value("price (USD).txt", "price (usd).*"));
    }

    // AC: WH-02.2
    #[test]
    fn regex_is_case_sensitive_and_exists_needs_a_value() {
        assert!(RuleOperator::Regex.test_value("Order 123", r"Order \d+"));
        assert!(!RuleOperator::Regex.test_value("order 123", r"^Order"));
        assert!(!RuleOperator::Regex.test_value("anything", "("));
        assert!(RuleOperator::Exists.test_value("x", ""));
        assert!(!RuleOperator::Exists.test_value("", ""));
    }
}
