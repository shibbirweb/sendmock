//! A scenario file (docs/plan/14-ai-integration.md, Scenarios): a name and `[[steps]]`, each
//! with `run`, an optional `with` table and an optional `save` name.

use serde_json::{Map, Value};

use super::scenario_wire::{ScenarioProblem, ScenarioValidation};

/// Steps that are not API operations.
pub const BUILTIN_STEPS: [&str; 3] = ["http", "assert", "sleep"];

#[derive(Debug, Clone, PartialEq)]
pub struct ScenarioStep {
    pub run: String,
    pub with: Map<String, Value>,
    pub save: Option<String>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct ParsedScenario {
    pub name: Option<String>,
    pub steps: Vec<ScenarioStep>,
    pub problems: Vec<ScenarioProblem>,
}

fn read_step(
    raw_step: &Value,
    step_number: usize,
    is_known_step: &dyn Fn(&str) -> bool,
    problems: &mut Vec<ScenarioProblem>,
) -> Option<ScenarioStep> {
    let Some(run) = raw_step["run"].as_str() else {
        problems.push(ScenarioProblem {
            step: Some(step_number),
            message: "A step needs run = \"<operation>\".".to_owned(),
        });
        return None;
    };
    if !is_known_step(run) && !BUILTIN_STEPS.contains(&run) {
        problems.push(ScenarioProblem {
            step: Some(step_number),
            message: format!("Unknown operation {run}."),
        });
    }
    Some(ScenarioStep {
        run: run.to_owned(),
        with: raw_step["with"].as_object().cloned().unwrap_or_default(),
        save: raw_step["save"].as_str().map(str::to_owned),
    })
}

/// Reads the file and lists its problems; `is_known_step` says which operations exist.
pub fn parse_scenario_file(
    scenario_text: &str,
    is_known_step: &dyn Fn(&str) -> bool,
) -> ParsedScenario {
    let parsed_file: Value = match scenario_text.parse::<toml::Table>() {
        Ok(toml_table) => serde_json::to_value(toml_table).unwrap_or(Value::Null),
        Err(parse_error) => {
            return ParsedScenario {
                name: None,
                steps: Vec::new(),
                problems: vec![ScenarioProblem {
                    step: None,
                    message: format!("Not valid TOML: {}", parse_error.message()),
                }],
            };
        }
    };
    let mut problems = Vec::new();
    let raw_steps = parsed_file["steps"].as_array().cloned().unwrap_or_default();
    if raw_steps.is_empty() {
        problems.push(ScenarioProblem {
            step: None,
            message: "Add at least one [[steps]] table.".to_owned(),
        });
    }
    let steps = raw_steps
        .iter()
        .enumerate()
        .filter_map(|(step_index, raw_step)| {
            read_step(raw_step, step_index + 1, is_known_step, &mut problems)
        })
        .collect();
    ParsedScenario {
        name: parsed_file["name"].as_str().map(str::to_owned),
        steps,
        problems,
    }
}

pub fn validate_scenario_file(
    scenario_text: &str,
    is_known_step: &dyn Fn(&str) -> bool,
) -> ScenarioValidation {
    let parsed_scenario = parse_scenario_file(scenario_text, is_known_step);
    ScenarioValidation {
        is_valid: parsed_scenario.problems.is_empty(),
        name: parsed_scenario.name,
        step_count: parsed_scenario.steps.len(),
        problems: parsed_scenario.problems,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: AI-04.2
    #[test]
    fn lists_unknown_operations_missing_runs_and_bad_toml_without_running() {
        let is_known_step = |step_name: &str| step_name == "email.send";
        let validation = validate_scenario_file(
            "name = \"Signup\"\n[[steps]]\nrun = \"email.send\"\n[[steps]]\nrun = \"rocket.launch\"\n[[steps]]\nwith = {}\n",
            &is_known_step,
        );
        let broken = validate_scenario_file("name = ", &is_known_step);

        assert!(!validation.is_valid);
        assert_eq!(validation.name.as_deref(), Some("Signup"));
        assert_eq!(validation.step_count, 2);
        assert_eq!(
            validation.problems[0],
            ScenarioProblem {
                step: Some(2),
                message: "Unknown operation rocket.launch.".to_owned()
            }
        );
        assert_eq!(validation.problems[1].step, Some(3));
        assert!(broken.problems[0].message.starts_with("Not valid TOML"));
    }
}
