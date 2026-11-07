//! Projects: names for captured traffic inside one instance (docs/plan/32-after-1-0.md, A5).

mod project_checks;
mod project_inputs;
mod project_operations;
mod project_views;

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
