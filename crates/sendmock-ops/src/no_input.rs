use schemars::JsonSchema;
use serde::Deserialize;

/// The input of an operation that takes none.
#[derive(Debug, Default, Clone, Copy, Deserialize, JsonSchema)]
pub struct NoInput {}
