//! The operation registry: each feature is one operation that REST, the CLI and MCP all call.

mod email;
mod input_coercion;
mod input_shape;
mod instance_details;
mod no_input;
mod operation;
mod operation_answer;
mod operation_context;
mod operation_error;
mod operation_registry;
mod page_of;
mod seed;
mod smtp_delivery;
mod system;

pub use email::{EmailAddress, EmailAttachment, EmailDetail, EmailSummary, ExtractedData};
pub use input_coercion::build_input_from_text;
pub use input_shape::{InputShape, ScalarType, describe_input_shape};
pub use instance_details::{InstanceDetails, ReleaseChannel};
pub use no_input::NoInput;
pub use operation::{
    AnswerKind, CliArgument, HttpMethod, Operation, OperationDefinition, OperationSelector,
    RawBodyInput, SuccessStatus, to_snake_case,
};
pub use operation_answer::{FileAnswer, NoContent, OperationAnswer};
pub use operation_context::OperationContext;
pub use operation_error::OperationError;
pub use operation_registry::{ErasedOperation, OperationRegistry};
pub use page_of::PageOf;
pub use seed::{
    SeedFileRequest, SeedItemCount, SeedValidation, SeedValidationError, ValidateSeedOperation,
    validate_seed_toml,
};
pub use smtp_delivery::{SmtpMessage, record_smtp_session, store_smtp_message};
pub use system::{AppInfo, GetHealthOperation, GetInfoOperation, HealthStatus};

/// Every operation this build of SendMock serves.
pub fn build_operation_registry() -> OperationRegistry {
    let mut operation_registry = OperationRegistry::default();
    operation_registry.register(GetHealthOperation);
    operation_registry.register(GetInfoOperation);
    operation_registry.register(ValidateSeedOperation);
    email::register_email_operations(&mut operation_registry);
    operation_registry
}
