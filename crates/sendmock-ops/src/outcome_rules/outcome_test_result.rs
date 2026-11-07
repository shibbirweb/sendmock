use schemars::JsonSchema;
use serde::Serialize;

/// Which source decides an outcome: a custom rule, a magic address or number, or the profile.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct OutcomeTestResult {
    /// `custom`, `magic` or `profile`.
    pub source: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub rule_id: Option<String>,
    /// One-based position of the matching custom rule.
    #[schemars(required, schema_with = "crate::nullable_schema::<u32>")]
    pub rule_position: Option<u32>,
    /// What the testers show, e.g. "Custom rule 2: Accepted, then undelivered, 30007".
    pub summary: String,
}

impl OutcomeTestResult {
    pub fn custom_rule(rule_id: &str, rule_position: u32, summary: String) -> Self {
        Self {
            source: "custom".to_owned(),
            rule_id: Some(rule_id.to_owned()),
            rule_position: Some(rule_position),
            summary,
        }
    }

    /// A magic address or number, named by `source` as `magic`.
    pub fn magic(summary: String) -> Self {
        Self {
            source: "magic".to_owned(),
            rule_id: None,
            rule_position: None,
            summary,
        }
    }

    pub fn profile(summary: String) -> Self {
        Self {
            source: "profile".to_owned(),
            rule_id: None,
            rule_position: None,
            summary,
        }
    }
}
