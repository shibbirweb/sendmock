mod typed_operation;

use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use schemars::Schema;
use serde_json::Value;

use crate::{Operation, OperationAnswer, OperationContext, OperationDefinition, OperationError};
use typed_operation::TypedOperation;

pub type AnswerFuture<'call> =
    Pin<Box<dyn Future<Output = Result<OperationAnswer, OperationError>> + Send + 'call>>;

/// An operation behind JSON in and an [`OperationAnswer`] out, so the registry can hold
/// operations of different types and every surface can call them the same way.
pub trait ErasedOperation: Send + Sync {
    fn definition(&self) -> &OperationDefinition;
    fn input_schema(&self) -> Schema;
    fn output_schema(&self) -> Schema;
    fn execute_answer<'call>(
        &'call self,
        operation_context: &'call OperationContext,
        input: Value,
    ) -> AnswerFuture<'call>;
}

#[derive(Default, Clone)]
pub struct OperationRegistry {
    operations: Vec<Arc<dyn ErasedOperation>>,
}

impl OperationRegistry {
    pub fn register<RegisteredOperation: Operation>(&mut self, operation: RegisteredOperation) {
        self.operations
            .push(Arc::new(TypedOperation::new(operation)));
    }

    pub fn operations(&self) -> &[Arc<dyn ErasedOperation>] {
        &self.operations
    }

    pub fn find_by_operation_id(&self, operation_id: &str) -> Option<&Arc<dyn ErasedOperation>> {
        self.operations
            .iter()
            .find(|operation| operation.definition().operation_id == operation_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_registered_operations_by_their_contract_id() {
        let operation_registry = crate::build_operation_registry();

        let operation_ids: Vec<&str> = operation_registry
            .operations()
            .iter()
            .map(|operation| operation.definition().operation_id)
            .collect();

        assert_eq!(
            &operation_ids[..3],
            ["getHealth", "getInfo", "postSeedValidate"]
        );
        assert!(operation_ids.contains(&"getEmails"));
        assert!(
            operation_registry
                .find_by_operation_id("getHealth")
                .is_some()
        );
        assert!(
            operation_registry
                .find_by_operation_id("listEmails")
                .is_none()
        );
    }

    #[test]
    fn describes_inputs_and_outputs_as_json_schema() {
        let operation_registry = crate::build_operation_registry();
        let health_operation = operation_registry.find_by_operation_id("getHealth");

        let output_schema = health_operation.map(|operation| operation.output_schema().to_value());

        assert_eq!(
            output_schema.and_then(|schema| schema["required"].as_array().cloned()),
            Some(vec![Value::from("status")])
        );
    }
}
