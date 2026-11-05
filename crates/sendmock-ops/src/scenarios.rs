//! Scenario files: steps over the operations, run in order and reported (AI-04).

mod scenario_file;
mod scenario_operations;
mod scenario_runner;
mod scenario_values;
mod scenario_wire;

pub use scenario_operations::{RunScenarioOperation, ValidateScenarioOperation};

use crate::OperationRegistry;

pub fn register_scenario_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ValidateScenarioOperation);
    operation_registry.register(RunScenarioOperation);
}
