//! Runs the demo data's steps through the operation registry, as an API client would, so the
//! sample data fires the same events, rules and deliveries as real traffic.

use serde::Deserialize;
use serde_json::{Map, Value, json};

use crate::scenarios::scenario_values::fill_step_input;
use crate::{OperationAnswer, OperationContext, OperationError, build_operation_registry};

/// Written from the mock's fixtures by `web/scripts/export-builtin-definitions.ts`.
const DEMO_DATA_JSON: &str = include_str!("../../builtin/demo-data.json");

#[derive(Debug, Deserialize)]
struct DemoData {
    steps: Vec<DemoStep>,
}

#[derive(Debug, Deserialize)]
struct DemoStep {
    operation_id: String,
    input: Value,
    #[serde(default)]
    save_as: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DemoLoadOutcome {
    Loaded {
        step_count: usize,
    },
    /// The instance already held data, so nothing was added.
    SkippedBecauseNotEmpty,
}

#[derive(Debug, thiserror::Error)]
pub enum DemoDataError {
    #[error("the demo data could not be read: {0}")]
    UnreadableData(#[from] serde_json::Error),
    #[error("the demo data names {0}, which this binary does not serve")]
    UnknownOperation(String),
    #[error("the demo step {operation_id} failed: {source}")]
    StepFailed {
        operation_id: String,
        source: OperationError,
    },
}

/// The operations whose lists must be empty for the demo data to load.
const EMPTINESS_CHECKS: [(&str, &str); 3] = [
    ("getEmails", "items"),
    ("getSms", "items"),
    ("getWebhooksEndpoints", ""),
];

/// An address bound to every interface (as in Docker) is reached on loopback.
fn to_reachable_address(http_address: &str) -> String {
    http_address.replacen("0.0.0.0:", "127.0.0.1:", 1)
}

fn has_listed_items(answer: &Value, items_field: &str) -> bool {
    let listed = if items_field.is_empty() {
        answer
    } else {
        &answer[items_field]
    };
    listed.as_array().is_some_and(|items| !items.is_empty())
}

async fn is_instance_empty(operation_context: &OperationContext) -> Result<bool, DemoDataError> {
    let operation_registry = build_operation_registry();
    for (operation_id, items_field) in EMPTINESS_CHECKS {
        let list_operation = operation_registry
            .find_by_operation_id(operation_id)
            .ok_or_else(|| DemoDataError::UnknownOperation(operation_id.to_owned()))?;
        let answer = list_operation
            .execute_answer(operation_context, json!({}))
            .await
            .map_err(|source| DemoDataError::StepFailed {
                operation_id: operation_id.to_owned(),
                source,
            })?;
        if let OperationAnswer::Json(listed) = answer
            && has_listed_items(&listed, items_field)
        {
            return Ok(false);
        }
    }
    Ok(true)
}

/// Loads the demo data into an empty instance; an instance with data is left as it is.
pub async fn load_demo_data(
    operation_context: &OperationContext,
) -> Result<DemoLoadOutcome, DemoDataError> {
    if !is_instance_empty(operation_context).await? {
        return Ok(DemoLoadOutcome::SkippedBecauseNotEmpty);
    }
    let demo_data: DemoData = serde_json::from_str(DEMO_DATA_JSON)?;
    let operation_registry = build_operation_registry();
    let mut placeholder_values = Map::new();
    placeholder_values.insert(
        "http_address".to_owned(),
        Value::String(to_reachable_address(
            &operation_context.instance_details.http_address,
        )),
    );
    let mut saved_answers = Map::new();
    for demo_step in &demo_data.steps {
        let step_operation = operation_registry
            .find_by_operation_id(&demo_step.operation_id)
            .ok_or_else(|| DemoDataError::UnknownOperation(demo_step.operation_id.clone()))?;
        placeholder_values.insert("saved".to_owned(), Value::Object(saved_answers.clone()));
        let step_input = fill_step_input(&placeholder_values, &demo_step.input);
        let answer = step_operation
            .execute_answer(operation_context, step_input)
            .await
            .map_err(|source| DemoDataError::StepFailed {
                operation_id: demo_step.operation_id.clone(),
                source,
            })?;
        if let (Some(saved_name), OperationAnswer::Json(answer_value)) =
            (&demo_step.save_as, answer)
        {
            saved_answers.insert(saved_name.clone(), answer_value);
        }
    }
    Ok(DemoLoadOutcome::Loaded {
        step_count: demo_data.steps.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_embedded_demo_data_names_only_served_operations() -> Result<(), DemoDataError> {
        let demo_data: DemoData = serde_json::from_str(DEMO_DATA_JSON)?;
        let operation_registry = build_operation_registry();

        assert!(!demo_data.steps.is_empty());
        for demo_step in &demo_data.steps {
            assert!(
                operation_registry
                    .find_by_operation_id(&demo_step.operation_id)
                    .is_some(),
                "{} is not served",
                demo_step.operation_id
            );
        }
        Ok(())
    }

    #[test]
    fn a_wildcard_address_is_reached_on_loopback() {
        assert_eq!(to_reachable_address("0.0.0.0:8025"), "127.0.0.1:8025");
        assert_eq!(to_reachable_address("127.0.0.1:8025"), "127.0.0.1:8025");
    }
}
