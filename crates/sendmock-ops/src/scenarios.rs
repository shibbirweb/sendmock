//! Scenario files: steps over the operations, run in order and reported (AI-04), and
//! scenarios saved by name (AI-07).

mod saved_scenario_checks;
mod saved_scenario_operations;
mod saved_scenario_wire;
mod scenario_file;
mod scenario_operations;
mod scenario_runner;
pub(crate) mod scenario_values;
mod scenario_wire;

pub(crate) use saved_scenario_checks::check_scenario_file;
pub use saved_scenario_operations::{
    DeleteSavedScenarioOperation, GetSavedScenarioOperation, ListSavedScenariosOperation,
    SaveScenarioOperation, UpdateSavedScenarioOperation,
};
pub use scenario_operations::{
    RunSavedScenarioOperation, RunScenarioOperation, ValidateScenarioOperation,
};

use crate::OperationRegistry;

pub fn register_scenario_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(ValidateScenarioOperation);
    operation_registry.register(RunScenarioOperation);
    operation_registry.register(ListSavedScenariosOperation);
    operation_registry.register(GetSavedScenarioOperation);
    operation_registry.register(SaveScenarioOperation);
    operation_registry.register(UpdateSavedScenarioOperation);
    operation_registry.register(DeleteSavedScenarioOperation);
    operation_registry.register(RunSavedScenarioOperation);
}
