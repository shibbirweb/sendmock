use schemars::JsonSchema;
use sendmock_store::WebhookVariableRecord;
use serde::Serialize;

use super::variable_inputs::{RandomMode, VariableKind, VariableScope};
use crate::{OperationError, mask_secret_value};

/// A webhook variable as the API shows it; a secret's value is masked.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct WebhookVariable {
    pub id: String,
    /// The name templates read it by, as `{{ vars.<name> }}`.
    pub name: String,
    pub kind: VariableKind,
    /// `global` for every endpoint, or `endpoint` for one; endpoint values win.
    pub scope: VariableScope,
    /// The endpoint of an `endpoint` variable; null for global ones.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub endpoint_id: Option<String>,
    /// Static value, expression, generator or default; secrets are masked.
    pub value: String,
    /// For `random`: `per_send` or `fixed`; null for other kinds.
    #[schemars(required, schema_with = "crate::nullable_schema::<RandomMode>")]
    pub random_mode: Option<RandomMode>,
    /// The generated value of a Fixed random variable; Regenerate replaces it.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub fixed_value: Option<String>,
    /// What the variable is for.
    pub description: String,
    /// `ui`, `api`, `cli`, `mcp` or `seed`.
    pub created_by: String,
}

pub fn read_variable_kind(
    stored_variable: &WebhookVariableRecord,
) -> Result<VariableKind, OperationError> {
    VariableKind::parse(&stored_variable.kind).ok_or_else(|| {
        OperationError::Internal(format!("Unknown variable kind {}", stored_variable.kind))
    })
}

pub fn build_variable_view(
    stored_variable: WebhookVariableRecord,
) -> Result<WebhookVariable, OperationError> {
    let kind = read_variable_kind(&stored_variable)?;
    let value = if kind == VariableKind::Secret {
        mask_secret_value(&stored_variable.value)
    } else {
        stored_variable.value
    };
    Ok(WebhookVariable {
        id: stored_variable.variable_id,
        name: stored_variable.name,
        kind,
        scope: if stored_variable.endpoint_id.is_some() {
            VariableScope::Endpoint
        } else {
            VariableScope::Global
        },
        endpoint_id: stored_variable.endpoint_id,
        value,
        random_mode: stored_variable
            .random_mode
            .as_deref()
            .and_then(RandomMode::parse),
        fixed_value: stored_variable.fixed_value,
        description: stored_variable.description,
        created_by: stored_variable.created_by,
    })
}
