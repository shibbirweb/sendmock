use std::collections::BTreeMap;

use serde_json::{Map, Value, json};

use super::api_client::ApiClient;
use super::mcp_session::McpSession;

/// One answer read during the sweep: where it came from and its text.
pub struct SweptAnswer {
    pub surface: String,
    pub text: String,
}

/// Paths whose answer is allowed to hold a secret (the confirmed reveals), that wait for
/// traffic, or that reach the internet; none of them is swept.
const UNSWEPT_PATH_PARTS: [&str; 4] = ["/secret", "/credentials/", "/wait/", "/updates"];
const UNSWEPT_TOOL_SUFFIXES: [&str; 2] = ["_wait", "_update_check"];

/// The values a path parameter is filled with, by its name in the API contract.
pub type PathValues = BTreeMap<String, Vec<String>>;

/// The items of a list answer, whether it is an array or an object holding one.
pub fn read_list_items(list_answer: &Value) -> Vec<Value> {
    if let Some(items) = list_answer.as_array() {
        return items.clone();
    }
    list_answer
        .as_object()
        .and_then(|fields| fields.values().find_map(Value::as_array))
        .cloned()
        .unwrap_or_default()
}

/// The `field_name` of every item in the list at `list_path`.
pub async fn harvest_field(
    api_client: &ApiClient,
    list_path: &str,
    field_name: &str,
) -> Vec<String> {
    read_list_items(&api_client.get(list_path).await.json())
        .iter()
        .filter_map(|item| item[field_name].as_str().map(str::to_owned))
        .collect()
}

/// Every GET path in the server's own OpenAPI document, filled with every combination of the
/// known parameter values; a path with a parameter that has no values is left out.
pub async fn sweep_rest_answers(
    api_client: &ApiClient,
    path_values: &PathValues,
) -> Vec<SweptAnswer> {
    let openapi_document = api_client.get("/api/openapi.json").await.json();
    let mut swept_answers = Vec::new();
    let path_entries = openapi_document["paths"]
        .as_object()
        .cloned()
        .unwrap_or_default();
    for (path_template, path_item) in path_entries {
        let is_swept = path_item.get("get").is_some()
            && path_template.starts_with("/api/v1/")
            && !UNSWEPT_PATH_PARTS
                .iter()
                .any(|part| path_template.contains(part));
        if !is_swept {
            continue;
        }
        for filled_path in fill_path_parameters(&path_template, path_values) {
            let answer = api_client.get(&filled_path).await;
            swept_answers.push(SweptAnswer {
                surface: format!("GET {filled_path} ({})", answer.status),
                text: answer.body_text,
            });
        }
    }
    swept_answers
}

fn fill_path_parameters(path_template: &str, path_values: &PathValues) -> Vec<String> {
    let Some(parameter_start) = path_template.find('{') else {
        return vec![path_template.to_owned()];
    };
    let Some(parameter_length) = path_template[parameter_start..].find('}') else {
        return Vec::new();
    };
    let parameter_name = &path_template[parameter_start + 1..parameter_start + parameter_length];
    let placeholder = &path_template[parameter_start..=parameter_start + parameter_length];
    path_values
        .get(parameter_name)
        .into_iter()
        .flatten()
        .flat_map(|parameter_value| {
            fill_path_parameters(
                &path_template.replacen(placeholder, parameter_value, 1),
                path_values,
            )
        })
        .collect()
}

/// `emailId` as the MCP tools name it, `email_id`.
fn to_snake_case(parameter_name: &str) -> String {
    parameter_name
        .chars()
        .fold(String::new(), |mut snake_name, character| {
            if character.is_ascii_uppercase() {
                snake_name.push('_');
            }
            snake_name.push(character.to_ascii_lowercase());
            snake_name
        })
}

/// Every read-only MCP tool, called once with only its required inputs and once with every
/// ID it takes, for each value of a required choice; then every listed resource.
pub fn sweep_mcp_answers(
    mcp_session: &mut McpSession,
    path_values: &PathValues,
) -> Vec<SweptAnswer> {
    let argument_values: PathValues = path_values
        .iter()
        .map(|(parameter_name, values)| (to_snake_case(parameter_name), values.clone()))
        .collect();
    let mut swept_answers = Vec::new();
    for tool in mcp_session.list_tools().unwrap_or_default() {
        let tool_name = tool["name"].as_str().unwrap_or_default().to_owned();
        if UNSWEPT_TOOL_SUFFIXES
            .iter()
            .any(|suffix| tool_name.ends_with(suffix))
        {
            continue;
        }
        for tool_arguments in build_tool_arguments(&tool, &argument_values) {
            let tool_result = mcp_session
                .call_tool(&tool_name, tool_arguments.clone())
                .unwrap_or_else(|call_error| json!({ "error": call_error.to_string() }));
            swept_answers.push(SweptAnswer {
                surface: format!("MCP {tool_name} {tool_arguments}"),
                text: tool_result.to_string(),
            });
        }
    }
    swept_answers.extend(sweep_mcp_resources(mcp_session));
    swept_answers
}

fn build_tool_arguments(tool: &Value, argument_values: &PathValues) -> Vec<Value> {
    let input_schema = &tool["inputSchema"];
    let properties = input_schema["properties"]
        .as_object()
        .cloned()
        .unwrap_or_default();
    let required_names: Vec<String> = input_schema["required"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|name| name.as_str().map(str::to_owned))
        .collect();
    let mut required_arguments = Map::new();
    let mut choice: Option<(String, Vec<Value>)> = None;
    for required_name in &required_names {
        if let Some(first_value) = argument_values
            .get(required_name)
            .and_then(|values| values.first())
        {
            required_arguments.insert(required_name.clone(), json!(first_value));
        } else if let Some(choice_values) = properties[required_name]["enum"].as_array() {
            choice = Some((required_name.clone(), choice_values.clone()));
        } else {
            return Vec::new();
        }
    }
    let mut every_id_arguments = required_arguments.clone();
    for property_name in properties.keys() {
        if let Some(first_value) = argument_values
            .get(property_name)
            .and_then(|values| values.first())
        {
            every_id_arguments.insert(property_name.clone(), json!(first_value));
        }
    }
    let mut argument_sets = vec![required_arguments];
    if every_id_arguments != argument_sets[0] {
        argument_sets.push(every_id_arguments);
    }
    expand_choice(argument_sets, choice)
}

/// Each argument set once per value of the required choice, or as it is without one.
fn expand_choice(
    argument_sets: Vec<Map<String, Value>>,
    choice: Option<(String, Vec<Value>)>,
) -> Vec<Value> {
    let Some((choice_name, choice_values)) = choice else {
        return argument_sets.into_iter().map(Value::Object).collect();
    };
    argument_sets
        .iter()
        .flat_map(|arguments| {
            choice_values.iter().map(|choice_value| {
                let mut chosen_arguments = arguments.clone();
                chosen_arguments.insert(choice_name.clone(), choice_value.clone());
                Value::Object(chosen_arguments)
            })
        })
        .collect()
}

fn sweep_mcp_resources(mcp_session: &mut McpSession) -> Vec<SweptAnswer> {
    let resource_list = mcp_session
        .request("resources/list", json!({}))
        .unwrap_or_default();
    let resource_uris: Vec<String> = resource_list["resources"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|resource| resource["uri"].as_str().map(str::to_owned))
        .collect();
    resource_uris
        .into_iter()
        .map(|resource_uri| {
            let resource = mcp_session
                .request("resources/read", json!({ "uri": resource_uri }))
                .unwrap_or_default();
            SweptAnswer {
                surface: format!("MCP resource {resource_uri}"),
                text: resource.to_string(),
            }
        })
        .collect()
}
