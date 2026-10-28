use schemars::Schema;
use serde_json::Value;

use std::any::Any;

use super::{AnswerFuture, ErasedOperation};
use crate::{
    FileAnswer, NoContent, Operation, OperationAnswer, OperationContext, OperationDefinition,
    OperationError,
};

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

    fn execute_answer<'call>(
        &'call self,
        operation_context: &'call OperationContext,
        input: Value,
    ) -> AnswerFuture<'call> {
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
            into_answer::<WrappedOperation::Output>(output)
        })
    }
}

/// Files and empty answers are told apart by their type; everything else is JSON.
fn into_answer<Output: serde::Serialize + 'static>(
    output: Output,
) -> Result<OperationAnswer, OperationError> {
    let boxed_output: Box<dyn Any> = Box::new(output);
    let boxed_output = match boxed_output.downcast::<FileAnswer>() {
        Ok(file_answer) => return Ok(OperationAnswer::File(*file_answer)),
        Err(other_output) => other_output,
    };
    if boxed_output.is::<NoContent>() {
        return Ok(OperationAnswer::Empty);
    }
    let typed_output = boxed_output.downcast::<Output>().map_err(|_| {
        OperationError::Internal("the operation answered an unexpected type".to_owned())
    })?;
    serde_json::to_value(*typed_output)
        .map(OperationAnswer::Json)
        .map_err(|encode_error| OperationError::Internal(encode_error.to_string()))
}
