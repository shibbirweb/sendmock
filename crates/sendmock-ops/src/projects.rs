//! Projects: names for captured traffic inside one instance (docs/plan/32-after-1-0.md, A5).

mod project_checks;
mod project_inputs;
mod project_operations;
mod project_views;

pub use project_checks::find_named_project;
pub(crate) use project_checks::{check_project_key, check_project_name};

/// The header a request names its project in; the traffic it captures is stored there.
pub const PROJECT_HEADER: &str = "x-sendmock-project";
use project_operations::{
    CreateProjectOperation, DeleteProjectOperation, ListProjectsOperation, UpdateProjectOperation,
};
pub use project_views::Project;

use crate::OperationRegistry;

pub fn register_project_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ListProjectsOperation);
    operation_registry.register(CreateProjectOperation);
    operation_registry.register(UpdateProjectOperation);
    operation_registry.register(DeleteProjectOperation);
}
