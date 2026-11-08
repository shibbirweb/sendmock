use schemars::JsonSchema;
use sendmock_store::RuleMoveDirection;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct OutcomeRuleReference {
    /// The rule's ID, from the list of rules of the same kind.
    pub rule_id: String,
}

/// `up` moves the rule one place earlier in the order, `down` one place later.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum OutcomeRuleMoveDirection {
    Up,
    Down,
}

/// Body of `POST /api/v1/outcome-rules/{kind}/{ruleId}/move`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct OutcomeRuleMoveInput {
    /// The rule's ID, from the list of rules of the same kind.
    pub rule_id: String,
    pub direction: OutcomeRuleMoveDirection,
}

impl OutcomeRuleMoveDirection {
    pub fn to_rule_move_direction(self) -> RuleMoveDirection {
        match self {
            Self::Up => RuleMoveDirection::Up,
            Self::Down => RuleMoveDirection::Down,
        }
    }
}
