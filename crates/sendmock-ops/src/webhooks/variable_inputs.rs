use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// How a variable gets its value.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum VariableKind {
    Text,
    Number,
    Boolean,
    Json,
    Secret,
    Dynamic,
    Random,
    Computed,
    Prompt,
}

impl VariableKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Number => "number",
            Self::Boolean => "boolean",
            Self::Json => "json",
            Self::Secret => "secret",
            Self::Dynamic => "dynamic",
            Self::Random => "random",
            Self::Computed => "computed",
            Self::Prompt => "prompt",
        }
    }

    pub fn parse(kind_text: &str) -> Option<Self> {
        serde_json::from_value(serde_json::Value::from(kind_text)).ok()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum VariableScope {
    Global,
    Endpoint,
}

/// `per_send` makes a new value for each delivery; `fixed` keeps one until Regenerate.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum RandomMode {
    PerSend,
    Fixed,
}

impl RandomMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::PerSend => "per_send",
            Self::Fixed => "fixed",
        }
    }

    pub fn parse(mode_text: &str) -> Option<Self> {
        serde_json::from_value(serde_json::Value::from(mode_text)).ok()
    }
}

/// Body of `POST` and `PATCH /api/v1/webhooks/variables`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WebhookVariableInput {
    /// The name templates read it by, as `{{ vars.<name> }}`.
    pub name: String,
    /// `text`, `number`, `boolean`, `json` and `secret` are fixed values; `dynamic` is read from the event, `random` is generated, `computed` combines other variables and `prompt` is asked for on manual sends.
    pub kind: VariableKind,
    /// `global` for every endpoint, or `endpoint` for one; endpoint values win.
    pub scope: VariableScope,
    /// The endpoint of an `endpoint` variable; null for global ones.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub endpoint_id: Option<String>,
    /// Static value, expression, generator or default. An empty secret on an edit keeps the stored one.
    pub value: String,
    /// For `random`: `per_send` or `fixed`; null for other kinds.
    #[schemars(required, schema_with = "crate::nullable_schema::<RandomMode>")]
    pub random_mode: Option<RandomMode>,
    /// What the variable is for.
    pub description: String,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WebhookVariableUpdate {
    /// The webhook variable's ID, from `GET /api/v1/webhooks/variables`.
    pub variable_id: String,
    #[serde(flatten)]
    pub changes: WebhookVariableInput,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WebhookVariableReference {
    /// The webhook variable's ID, from `GET /api/v1/webhooks/variables`.
    pub variable_id: String,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WebhookVariableListQuery {
    /// Only this endpoint's variables.
    pub endpoint_id: Option<String>,
}

/// Body of `POST /api/v1/webhooks/variables/preview`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct VariablePreviewRequest {
    /// The variable kind, as in a variable.
    pub kind: VariableKind,
    /// The value, expression or generator to try.
    pub value: String,
}
