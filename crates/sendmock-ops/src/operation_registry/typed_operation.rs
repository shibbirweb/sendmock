use schemars::Schema;
use serde_json::Value;

use super::{ErasedOperation, JsonResultFuture};
use crate::{Operation, OperationContext, OperationDefinition, OperationError};

pub struct TypedOperation<WrappedOperation: Operation> {
    operation: WrappedOperation,
    definition: OperationDefinition,
}

impl<WrappedOperation: Operation> TypedOperation<WrappedOperation> {
    pub fn new(operation: WrappedOperation) -> Self {
        let definition = operation.definition();
        Self {
            operation,
            definition,
        }
    }
}

impl<WrappedOperation: Operation> ErasedOperation for TypedOperation<WrappedOperation> {
    fn definition(&self) -> &OperationDefinition {
        &self.definition
    }

    fn input_schema(&self) -> Schema {
        schemars::schema_for!(WrappedOperation::Input)
    }

    fn output_schema(&self) -> Schema {
        schemars::schema_for!(WrappedOperation::Output)
    }

    fn execute_json<'call>(
        &'call self,
        operation_context: &'call OperationContext,
        input: Value,
    ) -> JsonResultFuture<'call> {
        Box::pin(async move {
            let typed_input = serde_json::from_value::<WrappedOperation::Input>(input).map_err(
                |decode_error| OperationError::InvalidInput {
                    message: decode_error.to_string(),
                    field: None,
                },
            )?;
            let output = self
                .operation
                .execute(operation_context, typed_input)
                .await?;
            serde_json::to_value(output)
                .map_err(|encode_error| OperationError::Internal(encode_error.to_string()))
        })
    }
}
