/// A stored payment flow, method or gateway definition, as JSON.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaymentDefinitionRecord {
    /// `flow`, `method` or `gateway`.
    pub kind: String,
    pub definition_key: String,
    pub definition_json: String,
    pub updated_at_unix_ms: i64,
}
