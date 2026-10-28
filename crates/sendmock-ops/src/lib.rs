//! The operation registry: each feature is one operation that REST, the CLI and MCP all call.

mod instance_details;
mod no_input;
mod operation;
mod operation_context;
mod operation_error;
mod operation_registry;
mod system;

pub use instance_details::{InstanceDetails, ReleaseChannel};
pub use no_input::NoInput;
pub use operation::{HttpMethod, Operation, OperationDefinition, OperationSelector};
pub use operation_context::OperationContext;
pub use operation_error::OperationError;
pub use operation_registry::{ErasedOperation, OperationRegistry};
pub use system::{AppInfo, GetHealthOperation, GetInfoOperation, HealthStatus};

/// Every operation this build of SendMock serves.
pub fn build_operation_registry() -> OperationRegistry {
    let mut operation_registry = OperationRegistry::default();
    operation_registry.register(GetHealthOperation);
    operation_registry.register(GetInfoOperation);
    operation_registry
}
