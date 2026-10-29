use super::rule_message::{HEADER_FIELD_PREFIX, RuleMessage};
use super::rule_operator::{RuleOperator, read_regex_error};

/// Every field a condition may name ([05](docs/plan/05-webhooks.md#rules-automatic-mode)).
const KNOWN_FIELDS: [&str; 12] = [
    "from",
    "to",
    "cc",
    "subject",
    "body",
    "has_attachment",
    "tag",
    "status",
    "api",
    "open_count",
    "first_open",
    "source",
];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FilterCondition {
    pub field_key: String,
    pub operator: RuleOperator,
    pub value: String,
}

/// A rule filter: conditions combined with `all`, `any` and `not`, nested to any depth.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FilterExpression {
    All(Vec<FilterExpression>),
    Any(Vec<FilterExpression>),
    Not(Box<FilterExpression>),
    Condition(FilterCondition),
}

impl FilterExpression {
    /// Whether the message passes; a field the message lacks never matches, and a field with
    /// several values matches when any value does (WH-02.2).
    pub fn matches(&self, rule_message: &RuleMessage) -> bool {
        match self {
            Self::All(child_expressions) => child_expressions
                .iter()
                .all(|child_expression| child_expression.matches(rule_message)),
            Self::Any(child_expressions) => child_expressions
                .iter()
                .any(|child_expression| child_expression.matches(rule_message)),
            Self::Not(child_expression) => !child_expression.matches(rule_message),
            Self::Condition(condition) => rule_message
                .read_field(&condition.field_key)
                .is_some_and(|field_values| {
                    field_values.iter().any(|field_value| {
                        condition.operator.test_value(field_value, &condition.value)
                    })
                }),
        }
    }
}

/// The problem with one condition, as the rule builder words it (WH-02.5).
fn validate_condition(condition: &FilterCondition) -> Option<String> {
    let is_header_field = condition.field_key.starts_with(HEADER_FIELD_PREFIX);
    if !is_header_field && !KNOWN_FIELDS.contains(&condition.field_key.as_str()) {
        return Some("Pick a field".to_owned());
    }
    if condition.field_key == HEADER_FIELD_PREFIX {
        return Some("Enter the header name".to_owned());
    }
    if condition.operator.needs_value() && condition.value.trim().is_empty() {
        return Some("Enter a value".to_owned());
    }
    if condition.operator == RuleOperator::Regex {
        return read_regex_error(&condition.value)
            .map(|regex_error| format!("Invalid regex: {regex_error}"));
    }
    None
}

/// The first incomplete condition anywhere in a filter.
pub fn find_first_filter_error(filter_expression: &FilterExpression) -> Option<String> {
    match filter_expression {
        FilterExpression::All(child_expressions) | FilterExpression::Any(child_expressions) => {
            child_expressions.iter().find_map(find_first_filter_error)
        }
        FilterExpression::Not(child_expression) => find_first_filter_error(child_expression),
        FilterExpression::Condition(condition) => validate_condition(condition),
    }
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeMap;

    use super::*;

    fn condition(field_key: &str, operator: RuleOperator, value: &str) -> FilterExpression {
        FilterExpression::Condition(FilterCondition {
            field_key: field_key.to_owned(),
            operator,
            value: value.to_owned(),
        })
    }

    fn support_email() -> RuleMessage {
        RuleMessage::default()
            .with_field("from", vec!["app@shop.test".to_owned()])
            .with_field(
                "to",
                vec![
                    "ann@example.com".to_owned(),
                    "help@support.local".to_owned(),
                ],
            )
            .with_field("subject", vec!["Ticket #42".to_owned()])
            .with_field("has_attachment", vec!["false".to_owned()])
            .with_headers(BTreeMap::from([(
                "X-Tenant".to_owned(),
                vec!["acme".to_owned()],
            )]))
    }

    // AC: WH-02.2
    #[test]
    fn combinators_nest_and_any_recipient_can_match() {
        let filter = FilterExpression::All(vec![
            condition("to", RuleOperator::Matches, "*@support.local"),
            FilterExpression::Any(vec![
                condition("subject", RuleOperator::Contains, "ticket"),
                condition("subject", RuleOperator::Contains, "refund"),
            ]),
            FilterExpression::Not(Box::new(condition(
                "has_attachment",
                RuleOperator::Equals,
                "true",
            ))),
        ]);

        assert!(filter.matches(&support_email()));
    }

    // AC: WH-02.2
    #[test]
    fn headers_are_read_by_name_and_missing_fields_never_match() {
        assert!(
            condition("header:x-tenant", RuleOperator::Equals, "ACME").matches(&support_email())
        );
        assert!(!condition("header:x-missing", RuleOperator::Exists, "").matches(&support_email()));
        assert!(!condition("status", RuleOperator::Exists, "").matches(&support_email()));
        assert!(
            FilterExpression::Not(Box::new(condition("status", RuleOperator::Exists, "")))
                .matches(&support_email())
        );
        assert!(
            !condition("header:x-tenant", RuleOperator::Exists, "")
                .matches(&RuleMessage::default().with_field("body", vec!["Hi".to_owned()]))
        );
    }

    // AC: WH-02.5
    #[test]
    fn incomplete_conditions_are_named_like_the_builder_names_them() {
        let problems: Vec<Option<String>> = [
            condition("color", RuleOperator::Equals, "red"),
            condition("header:", RuleOperator::Equals, "x"),
            condition("subject", RuleOperator::Contains, "  "),
            condition("subject", RuleOperator::Regex, "("),
            condition("subject", RuleOperator::Exists, ""),
        ]
        .iter()
        .map(find_first_filter_error)
        .collect();

        assert_eq!(problems[0].as_deref(), Some("Pick a field"));
        assert_eq!(problems[1].as_deref(), Some("Enter the header name"));
        assert_eq!(problems[2].as_deref(), Some("Enter a value"));
        assert!(
            problems[3]
                .as_deref()
                .is_some_and(|problem| problem.starts_with("Invalid regex"))
        );
        assert_eq!(problems[4], None);
    }
}
