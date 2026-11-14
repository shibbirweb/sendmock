/// A webhook variable as stored; the operations layer owns the kinds and their rules.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WebhookVariableRecord {
    pub variable_id: String,
    pub name: String,
    /// `text`, `number`, `boolean`, `json`, `secret`, `dynamic`, `random`, `computed` or `prompt`.
    pub kind: String,
    /// The endpoint of an endpoint variable; none for a global one.
    pub endpoint_id: Option<String>,
    /// The static value, expression, generator or prompt default, as written.
    pub value: String,
    /// `per_send` or `fixed` for a random variable.
    pub random_mode: Option<String>,
    /// The value a Fixed random variable keeps until it is regenerated.
    pub fixed_value: Option<String>,
    pub description: String,
    /// `ui`, `api`, `cli`, `mcp` or `seed`.
    pub created_by: String,
    pub created_at_unix_ms: i64,
}
