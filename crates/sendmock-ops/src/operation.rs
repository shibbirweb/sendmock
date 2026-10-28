use std::future::Future;

use schemars::JsonSchema;
use serde::Serialize;
use serde::de::DeserializeOwned;

use crate::{OperationContext, OperationError};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Patch,
    Delete,
}

/// What every surface needs to know about an operation, named as in `docs/api/openapi.yaml`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OperationDefinition {
    pub operation_id: &'static str,
    pub method: HttpMethod,
    pub path: &'static str,
    pub summary: &'static str,
    pub is_read_only: bool,
}

/// One feature, defined once: typed input, typed output and the handler (the Command pattern).
pub trait Operation: Send + Sync + 'static {
    type Input: DeserializeOwned + JsonSchema + Send + 'static;
    type Output: Serialize + JsonSchema + Send + 'static;

    fn definition(&self) -> OperationDefinition;

    fn execute(
        &self,
        operation_context: &OperationContext,
        input: Self::Input,
    ) -> impl Future<Output = Result<Self::Output, OperationError>> + Send;
}
