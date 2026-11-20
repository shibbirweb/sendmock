use sendmock_store::SavedScenarioRecord;

use super::scenario_file::validate_scenario_file;
use super::scenario_runner::build_step_operations;
use crate::{OperationContext, OperationError, build_operation_registry};

/// The saved scenario with this id, or else this name.
pub async fn find_saved_scenario(
    operation_context: &OperationContext,
    scenario_id_or_name: &str,
) -> Result<SavedScenarioRecord, OperationError> {
    let saved_scenarios = &operation_context.saved_scenarios;
    if let Some(stored_scenario) = saved_scenarios.find_scenario(scenario_id_or_name).await? {
        return Ok(stored_scenario);
    }
    saved_scenarios
        .find_scenario_by_name(scenario_id_or_name)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No saved scenario with id or name {scenario_id_or_name}"),
        })
}

/// A name is required and no other saved scenario may have it.
pub async fn check_scenario_name(
    operation_context: &OperationContext,
    scenario_name: &str,
    own_scenario_id: Option<&str>,
) -> Result<(), OperationError> {
    if scenario_name.is_empty() {
        return Err(OperationError::InvalidInput {
            message: "Enter a name".to_owned(),
            field: Some("name".to_owned()),
        });
    }
    let same_name_scenario = operation_context
        .saved_scenarios
        .find_scenario_by_name(scenario_name)
        .await?;
    let is_taken = same_name_scenario.is_some_and(|stored_scenario| {
        Some(stored_scenario.scenario_id.as_str()) != own_scenario_id
    });
    if is_taken {
        return Err(OperationError::Conflict {
            code: "scenario_exists",
            message: format!("A saved scenario named {scenario_name} already exists"),
        });
    }
    Ok(())
}

/// Refuses a scenario file `scenario validate` would report problems in, listing them by step.
pub fn check_scenario_file(scenario_text: &str) -> Result<(), OperationError> {
    let step_operations = build_step_operations(&build_operation_registry());
    let scenario_validation = validate_scenario_file(scenario_text, &|step_name| {
        step_operations.contains_key(step_name)
    });
    if scenario_validation.is_valid {
        return Ok(());
    }
    let problems = scenario_validation
        .problems
        .iter()
        .map(|problem| match problem.step {
            Some(step_number) => format!("step {step_number}: {}", problem.message),
            None => problem.message.clone(),
        })
        .collect::<Vec<_>>()
        .join("; ");
    Err(OperationError::Unprocessable {
        code: "invalid_scenario",
        message: format!("The scenario is not valid: {problems}"),
    })
}
