//! SendMock in CI/CD pipelines (WH-15): a CI file naming the setup, the app and the
//! scenarios, run with reports CI systems show, and the files `sendmock ci init` writes.

mod ci_file;
mod ci_init;
mod ci_json_schema;
mod ci_operations;
mod ci_pipeline_jobs;
mod ci_reports;
mod ci_runner;
mod ci_wire;

pub use ci_file::{CI_FORMAT_NAME, CI_FORMAT_VERSION, CiFile, parse_ci_file};
pub use ci_init::{CiInitFile, CiInitFiles, CiInitRequest, InitCiOperation};
pub use ci_json_schema::build_ci_json_schema;
pub use ci_operations::{RunCiOperation, ValidateCiOperation};
pub use ci_pipeline_jobs::CiSystem;
pub use ci_wire::{CiFileRequest, CiReport, CiValidation};

use crate::OperationRegistry;

pub fn register_ci_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ValidateCiOperation);
    operation_registry.register(RunCiOperation);
    operation_registry.register(InitCiOperation);
}
