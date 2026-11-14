//! Checks an answer against Mailpit's own API definitions (`fixtures/mailpit/`): every
//! property is there with Mailpit's type, and nothing Mailpit does not have.

use serde_json::Value;

fn load_definitions() -> Value {
    let definitions_text = include_str!("../fixtures/mailpit/mailpit-definitions.json");
    serde_json::from_str::<Value>(definitions_text)
        .unwrap_or_else(|parse_error| panic!("the Mailpit definitions parse: {parse_error}"))
        ["definitions"]
        .clone()
}

fn check_schema(value: &Value, schema: &Value, definitions: &Value, path: &str) -> Vec<String> {
    if let Some(reference) = schema["$ref"].as_str() {
        let definition_name = reference.trim_start_matches("#/definitions/");
        return check_schema(value, &definitions[definition_name], definitions, path);
    }
    match schema["type"].as_str() {
        Some("string") if !value.is_string() => vec![format!("{path} is not a string: {value}")],
        Some("integer") if !value.is_u64() && !value.is_i64() => {
            vec![format!("{path} is not an integer: {value}")]
        }
        Some("boolean") if !value.is_boolean() => vec![format!("{path} is not a boolean: {value}")],
        Some("array") => match value.as_array() {
            Some(items) => items
                .iter()
                .enumerate()
                .flat_map(|(index, item)| {
                    check_schema(
                        item,
                        &schema["items"],
                        definitions,
                        &format!("{path}[{index}]"),
                    )
                })
                .collect(),
            None => vec![format!("{path} is not an array: {value}")],
        },
        Some("object") | None if schema["properties"].is_object() => {
            check_object(value, schema, definitions, path)
        }
        _ => Vec::new(),
    }
}

fn check_object(value: &Value, schema: &Value, definitions: &Value, path: &str) -> Vec<String> {
    let Some(fields) = value.as_object() else {
        return vec![format!("{path} is not an object: {value}")];
    };
    let properties = schema["properties"]
        .as_object()
        .cloned()
        .unwrap_or_default();
    let mut problems: Vec<String> = fields
        .keys()
        .filter(|field_name| !properties.contains_key(*field_name))
        .map(|field_name| format!("{path}.{field_name} is not in Mailpit's definition"))
        .collect();
    for (property_name, property_schema) in &properties {
        match fields.get(property_name) {
            Some(field_value) => problems.extend(check_schema(
                field_value,
                property_schema,
                definitions,
                &format!("{path}.{property_name}"),
            )),
            None => problems.push(format!("{path}.{property_name} is missing")),
        }
    }
    problems
}

/// The ways `value` differs from Mailpit's definition `definition_name`; empty when it matches.
pub fn compare_with_mailpit(value: &Value, definition_name: &str) -> Vec<String> {
    let definitions = load_definitions();
    check_schema(
        value,
        &definitions[definition_name],
        &definitions,
        definition_name,
    )
}
