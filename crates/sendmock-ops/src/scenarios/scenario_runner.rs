//! Runs a scenario's steps in order through the operation registry, saving outputs for later
//! steps and skipping the rest after the first failure (AI-04.1).

use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use serde_json::{Map, Value};

use super::scenario_file::{ScenarioStep, parse_scenario_file};
use super::scenario_values::{evaluate_assertion, fill_step_input, fill_template};
use super::scenario_wire::{ScenarioReport, ScenarioStepResult, ScenarioStepStatus};
use crate::sms::RecordedHttpRequest;
use crate::{
    ErasedOperation, OperationAnswer, OperationContext, OperationError, OperationRegistry,
};

const LONGEST_SLEEP: Duration = Duration::from_secs(2);
const HTTP_STEP_TIMEOUT_MS: u32 = 10_000;

/// `sendmock_webhook_endpoint_create` is the step `webhook.endpoint.create`; the first
/// operation with a tool name wins, as in the mock.
pub fn build_step_operations(
    operation_registry: &OperationRegistry,
) -> BTreeMap<String, Arc<dyn ErasedOperation>> {
    let mut step_operations: BTreeMap<String, Arc<dyn ErasedOperation>> = BTreeMap::new();
    for operation in operation_registry.operations() {
        let definition = operation.definition();
        for tool_name in
            std::iter::once(definition.mcp_tool).chain(definition.mcp_aliases.iter().copied())
        {
            if let Some(tool_suffix) = tool_name.strip_prefix("sendmock_") {
                step_operations
                    .entry(tool_suffix.replace('_', "."))
                    .or_insert_with(|| Arc::clone(operation));
            }
        }
    }
    step_operations
}

/// What one step did.
struct StepOutcome {
    status: ScenarioStepStatus,
    output: Value,
    error: Option<String>,
}

impl StepOutcome {
    fn passed(output: Value) -> Self {
        Self {
            status: ScenarioStepStatus::Passed,
            output,
            error: None,
        }
    }

    fn failed(output: Value, error: String) -> Self {
        Self {
            status: ScenarioStepStatus::Failed,
            output,
            error: Some(error),
        }
    }
}

/// The HTTP status the REST API would answer, as the mock's step errors read.
fn read_status_code(operation_error: &OperationError) -> u16 {
    match operation_error {
        OperationError::InvalidInput { .. } => 400,
        OperationError::NotFound { .. } => 404,
        OperationError::Timeout { .. } => 408,
        OperationError::Conflict { .. } => 409,
        OperationError::Rejected { .. } | OperationError::Unprocessable { .. } => 422,
        OperationError::Upstream { .. } => 502,
        OperationError::Store(_) | OperationError::Internal(_) => 500,
    }
}

async fn run_operation_step(
    operation_context: &OperationContext,
    operation: &dyn ErasedOperation,
    mut step_input: Map<String, Value>,
) -> StepOutcome {
    for (placeholder, input_name) in operation.definition().path_parameter_names() {
        if step_input.contains_key(&input_name) {
            continue;
        }
        if let Some(path_value) = step_input
            .remove(&placeholder)
            .or_else(|| step_input.remove("id"))
        {
            step_input.insert(input_name, path_value);
        }
    }
    match operation
        .execute_answer(operation_context, Value::Object(step_input))
        .await
    {
        Ok(OperationAnswer::Json(output)) => StepOutcome::passed(output),
        Ok(OperationAnswer::File(file_answer)) => StepOutcome::passed(Value::from(
            String::from_utf8_lossy(&file_answer.bytes).into_owned(),
        )),
        Ok(OperationAnswer::Empty) => StepOutcome::passed(Value::Null),
        Err(operation_error) => StepOutcome::failed(
            Value::Null,
            format!("{}: {operation_error}", read_status_code(&operation_error)),
        ),
    }
}

fn build_http_step_request(
    operation_context: &OperationContext,
    step_input: &Map<String, Value>,
) -> RecordedHttpRequest {
    let target_url = step_input
        .get("url")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let full_url = if target_url.starts_with('/') {
        format!(
            "http://{}{target_url}",
            operation_context.instance_details.http_address
        )
    } else {
        target_url.to_owned()
    };
    RecordedHttpRequest {
        method: step_input
            .get("method")
            .and_then(Value::as_str)
            .unwrap_or("GET")
            .to_ascii_uppercase(),
        url: full_url,
        headers: [("content-type".to_owned(), "application/json".to_owned())].into(),
        body: step_input
            .get("json")
            .map(Value::to_string)
            .unwrap_or_default(),
    }
}

/// `http`: a request to a URL (a path is SendMock's own API); its answer is the output.
async fn run_http_step(
    operation_context: &OperationContext,
    step_input: &Map<String, Value>,
) -> StepOutcome {
    let request = build_http_step_request(operation_context, step_input);
    let Some(webhook_sender) = &operation_context.webhook_sender else {
        return StepOutcome::failed(
            Value::Null,
            "This build cannot send HTTP requests".to_owned(),
        );
    };
    let send_result = webhook_sender
        .send_webhook(&request, HTTP_STEP_TIMEOUT_MS)
        .await;
    let Some(response) = send_result.response else {
        return StepOutcome::failed(
            Value::Null,
            send_result
                .error_message
                .unwrap_or_else(|| "No answer".to_owned()),
        );
    };
    let output = serde_json::from_str(&response.body).unwrap_or(Value::from(response.body));
    if response.status_code < 400 {
        StepOutcome::passed(output)
    } else {
        StepOutcome::failed(output, format!("{}: request failed", response.status_code))
    }
}

async fn run_step(
    operation_context: &OperationContext,
    step_operations: &BTreeMap<String, Arc<dyn ErasedOperation>>,
    step: &ScenarioStep,
    saved_values: &Map<String, Value>,
) -> (Value, StepOutcome) {
    let step_input = fill_step_input(saved_values, &Value::Object(step.with.clone()));
    let input_fields = step_input.as_object().cloned().unwrap_or_default();
    let outcome = match (step_operations.get(&step.run), step.run.as_str()) {
        (Some(operation), _) => {
            run_operation_step(operation_context, operation.as_ref(), input_fields).await
        }
        (None, "sleep") => {
            let seconds = input_fields
                .get("seconds")
                .and_then(Value::as_f64)
                .unwrap_or(1.0)
                .max(0.0);
            tokio::time::sleep(Duration::from_secs_f64(seconds).min(LONGEST_SLEEP)).await;
            StepOutcome::passed(Value::Null)
        }
        (None, "assert") => {
            let assertion_text = step
                .with
                .get("that")
                .and_then(Value::as_str)
                .unwrap_or_default();
            let filled_text = match fill_template(saved_values, assertion_text) {
                Value::String(text) => text,
                other_value => other_value.to_string(),
            };
            if evaluate_assertion(&filled_text) {
                StepOutcome::passed(Value::from(filled_text))
            } else {
                StepOutcome::failed(
                    Value::from(filled_text.clone()),
                    format!("Not true: {filled_text}"),
                )
            }
        }
        (None, _) => run_http_step(operation_context, &input_fields).await,
    };
    (step_input, outcome)
}

fn read_elapsed_ms(started_at: Instant) -> u64 {
    u64::try_from(started_at.elapsed().as_millis()).unwrap_or(u64::MAX)
}

/// Runs the steps in order; once one fails the rest are skipped.
async fn run_steps(
    operation_context: &OperationContext,
    step_operations: &BTreeMap<String, Arc<dyn ErasedOperation>>,
    steps: &[ScenarioStep],
) -> Vec<ScenarioStepResult> {
    let mut saved_values = Map::new();
    let mut step_results = Vec::new();
    let mut has_failed = false;
    for (step_index, step) in steps.iter().enumerate() {
        let step_started_at = Instant::now();
        let (step_input, outcome) = if has_failed {
            let skipped = StepOutcome {
                status: ScenarioStepStatus::Skipped,
                output: Value::Null,
                error: Some("An earlier step failed.".to_owned()),
            };
            (Value::Object(step.with.clone()), skipped)
        } else {
            run_step(operation_context, step_operations, step, &saved_values).await
        };
        has_failed |= outcome.status == ScenarioStepStatus::Failed;
        let saved_as = step
            .save
            .clone()
            .filter(|_| outcome.status == ScenarioStepStatus::Passed);
        if let Some(save_name) = &saved_as {
            saved_values.insert(save_name.clone(), outcome.output.clone());
        }
        step_results.push(ScenarioStepResult {
            step: step_index + 1,
            run: step.run.clone(),
            status: outcome.status,
            input: step_input,
            output: outcome.output,
            error: outcome.error,
            saved_as,
            duration_ms: read_elapsed_ms(step_started_at),
        });
    }
    step_results
}

/// Runs the file; a file with problems answers them instead of a report.
pub async fn run_scenario(
    operation_context: &OperationContext,
    operation_registry: &OperationRegistry,
    scenario_text: &str,
) -> Result<ScenarioReport, OperationError> {
    let step_operations = build_step_operations(operation_registry);
    let parsed_scenario = parse_scenario_file(scenario_text, &|step_name| {
        step_operations.contains_key(step_name)
    });
    if let Some(first_problem) = parsed_scenario.problems.first() {
        return Err(OperationError::InvalidInput {
            message: first_problem.message.clone(),
            field: Some("scenario".to_owned()),
        });
    }
    let started_at = Instant::now();
    let started_at_unix_ms = operation_context.clock.now_unix_ms();
    let step_results = run_steps(operation_context, &step_operations, &parsed_scenario.steps).await;
    Ok(ScenarioReport {
        name: parsed_scenario
            .name
            .unwrap_or_else(|| "scenario".to_owned()),
        is_passed: step_results
            .iter()
            .all(|step_result| step_result.status != ScenarioStepStatus::Failed),
        started_at: sendmock_core::format_rfc3339(started_at_unix_ms),
        duration_ms: read_elapsed_ms(started_at),
        steps: step_results,
    })
}
