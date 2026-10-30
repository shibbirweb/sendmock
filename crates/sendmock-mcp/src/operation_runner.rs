use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use sendmock_ops::{ErasedOperation, OperationAnswer, OperationContext};
use serde_json::Value;

pub type RunFuture<'runner> =
    Pin<Box<dyn Future<Output = Result<OperationAnswer, String>> + Send + 'runner>>;

/// How a tool call reaches its operation: in this process, or over the REST API of a
/// running SendMock (what `sendmock mcp` over stdio does).
pub trait OperationRunner: Send + Sync {
    fn run_operation(&self, operation: Arc<dyn ErasedOperation>, input: Value) -> RunFuture<'_>;
}

/// Runs operations directly, for the MCP endpoint inside the server.
pub struct InProcessOperationRunner {
    operation_context: OperationContext,
}

impl InProcessOperationRunner {
    pub fn new(operation_context: OperationContext) -> Self {
        Self { operation_context }
    }
}

impl OperationRunner for InProcessOperationRunner {
    fn run_operation(&self, operation: Arc<dyn ErasedOperation>, input: Value) -> RunFuture<'_> {
        Box::pin(async move {
            operation
                .execute_answer(&self.operation_context, input)
                .await
                .map_err(|operation_error| operation_error.to_string())
        })
    }
}
