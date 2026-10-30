use schemars::JsonSchema;
use sendmock_webhooks::{FilterCondition, FilterExpression, RuleOperator};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum RuleFilterOperator {
    Equals,
    Contains,
    StartsWith,
    Matches,
    Regex,
    Exists,
}

/// One condition: a field, an operator and a value (ignored by `exists`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct RuleCondition {
    /// `from`, `to`, `cc`, `subject`, `body`, `header:<name>`, `has_attachment`, `tag`,
    /// `status`, `api`, `open_count`, `first_open` or `source`.
    pub field: String,
    pub operator: RuleFilterOperator,
    pub value: String,
}

/// A filter as the API sends it: a condition, or `all`, `any` or `not` around more filters.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(untagged)]
pub enum RuleFilter {
    All { all: Vec<RuleFilter> },
    Any { any: Vec<RuleFilter> },
    Not { not: Box<RuleFilter> },
    Condition(RuleCondition),
}

impl From<RuleFilterOperator> for RuleOperator {
    fn from(filter_operator: RuleFilterOperator) -> Self {
        match filter_operator {
            RuleFilterOperator::Equals => Self::Equals,
            RuleFilterOperator::Contains => Self::Contains,
            RuleFilterOperator::StartsWith => Self::StartsWith,
            RuleFilterOperator::Matches => Self::Matches,
            RuleFilterOperator::Regex => Self::Regex,
            RuleFilterOperator::Exists => Self::Exists,
        }
    }
}

impl From<&RuleFilter> for FilterExpression {
    fn from(rule_filter: &RuleFilter) -> Self {
        match rule_filter {
            RuleFilter::All { all } => Self::All(all.iter().map(Self::from).collect()),
            RuleFilter::Any { any } => Self::Any(any.iter().map(Self::from).collect()),
            RuleFilter::Not { not } => Self::Not(Box::new(Self::from(not.as_ref()))),
            RuleFilter::Condition(condition) => Self::Condition(FilterCondition {
                field_key: condition.field.clone(),
                operator: RuleOperator::from(condition.operator),
                value: condition.value.clone(),
            }),
        }
    }
}
