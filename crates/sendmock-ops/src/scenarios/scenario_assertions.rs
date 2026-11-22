//! The `assert` step: an expression (`that`), or a JSONPath into a JSON body (`path` with
//! `equals` or `exists`), as a CI scenario checks a webhook's body (WH-15.5).

use serde_json::{Map, Value};

use super::scenario_values::{evaluate_assertion, fill_template};

/// One step of a JSONPath: a key or an index.
enum PathStep {
    Key(String),
    Index(usize),
}

/// `$.data.items[0].id`, `$['key with spaces']`; `None` for anything else.
fn parse_json_path(json_path: &str) -> Option<Vec<PathStep>> {
    let mut remaining = json_path.trim().strip_prefix('$')?;
    let mut path_steps = Vec::new();
    while !remaining.is_empty() {
        if let Some(after_dot) = remaining.strip_prefix('.') {
            let key_length = after_dot.find(['.', '[']).unwrap_or(after_dot.len());
            if key_length == 0 {
                return None;
            }
            path_steps.push(PathStep::Key(after_dot[..key_length].to_owned()));
            remaining = &after_dot[key_length..];
        } else {
            let after_bracket = remaining.strip_prefix('[')?;
            let closing = after_bracket.find(']')?;
            let inside = after_bracket[..closing].trim();
            let quoted_key = inside
                .strip_prefix('\'')
                .and_then(|quoted| quoted.strip_suffix('\''))
                .or_else(|| {
                    inside
                        .strip_prefix('"')
                        .and_then(|quoted| quoted.strip_suffix('"'))
                });
            path_steps.push(match quoted_key {
                Some(key) => PathStep::Key(key.to_owned()),
                None => PathStep::Index(inside.parse().ok()?),
            });
            remaining = &after_bracket[closing + 1..];
        }
    }
    Some(path_steps)
}

/// The value at the path, or `None` when the path does not parse or leads nowhere.
pub fn read_json_path(document: &Value, json_path: &str) -> Option<Value> {
    parse_json_path(json_path)?
        .iter()
        .try_fold(document, |current_value, path_step| match path_step {
            PathStep::Key(key) => current_value.get(key),
            PathStep::Index(index) => current_value.get(index),
        })
        .cloned()
}

/// A body sent as text is read as JSON; anything else is used as it is.
fn read_json_input(json_input: Option<&Value>) -> Value {
    match json_input {
        Some(Value::String(json_text)) => {
            serde_json::from_str(json_text).unwrap_or_else(|_| Value::from(json_text.as_str()))
        }
        Some(json_value) => json_value.clone(),
        None => Value::Null,
    }
}

/// Equal as JSON, or a number or boolean equal to the text expected, since templates fill
/// values in as text.
fn is_equal(found_value: &Value, expected_value: &Value) -> bool {
    if found_value == expected_value {
        return true;
    }
    match (found_value, expected_value) {
        (Value::String(_), _) => false,
        (found, Value::String(expected)) => found.to_string().as_str() == expected.as_str(),
        _ => false,
    }
}

fn assert_json_path(
    input_fields: &Map<String, Value>,
    json_path: &str,
) -> Result<Value, (Value, String)> {
    let document = read_json_input(input_fields.get("json"));
    let found_value = read_json_path(&document, json_path);
    let must_exist = input_fields.get("exists").and_then(Value::as_bool);
    match (found_value, input_fields.get("equals"), must_exist) {
        (None, _, Some(false)) => Ok(Value::Null),
        (None, _, _) => Err((Value::Null, format!("Nothing at {json_path}"))),
        (Some(found), _, Some(false)) => Err((found, format!("{json_path} exists"))),
        (Some(found), Some(expected), _) if !is_equal(&found, expected) => Err((
            found.clone(),
            format!("{json_path} is {found}, not {expected}"),
        )),
        (Some(found), _, _) => Ok(found),
    }
}

/// Runs the assertion; `Err` carries the output and the reason it failed.
pub fn run_assert_step(
    saved_values: &Map<String, Value>,
    step_with: &Map<String, Value>,
    input_fields: &Map<String, Value>,
) -> Result<Value, (Value, String)> {
    if let Some(json_path) = input_fields.get("path").and_then(Value::as_str) {
        return assert_json_path(input_fields, json_path);
    }
    let assertion_text = step_with
        .get("that")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let filled_text = match fill_template(saved_values, assertion_text) {
        Value::String(text) => text,
        other_value => other_value.to_string(),
    };
    if evaluate_assertion(&filled_text) {
        Ok(Value::from(filled_text))
    } else {
        Err((
            Value::from(filled_text.clone()),
            format!("Not true: {filled_text}"),
        ))
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    // AC: WH-15.5
    #[test]
    fn a_json_path_reads_keys_indexes_and_quoted_keys() {
        let document =
            json!({ "data": { "items": [{ "id": "evt_1" }], "the type": "order.paid" } });

        assert_eq!(
            read_json_path(&document, "$.data.items[0].id"),
            Some(json!("evt_1"))
        );
        assert_eq!(
            read_json_path(&document, "$.data['the type']"),
            Some(json!("order.paid"))
        );
        assert_eq!(read_json_path(&document, "$.data.missing"), None);
        assert_eq!(read_json_path(&document, "data.items"), None);
    }

    // AC: WH-15.5
    #[test]
    fn an_assert_on_a_json_body_checks_equals_and_exists() {
        let body_text = json!("{\"type\":\"order.paid\",\"amount\":4200}");
        let check = |extra: serde_json::Value| {
            let mut input_fields = json!({ "json": body_text })
                .as_object()
                .cloned()
                .unwrap_or_default();
            input_fields.extend(extra.as_object().cloned().unwrap_or_default());
            run_assert_step(&Map::new(), &Map::new(), &input_fields)
        };

        assert_eq!(
            check(json!({ "path": "$.type", "equals": "order.paid" })),
            Ok(json!("order.paid"))
        );
        assert_eq!(
            check(json!({ "path": "$.amount", "equals": "4200" })),
            Ok(json!(4200))
        );
        assert!(
            check(json!({ "path": "$.type", "equals": "order.failed" })).is_err_and(
                |(_, reason)| reason == "$.type is \"order.paid\", not \"order.failed\""
            )
        );
        assert_eq!(
            check(json!({ "path": "$.refund", "exists": false })),
            Ok(Value::Null)
        );
        assert!(
            check(json!({ "path": "$.refund" }))
                .is_err_and(|(_, reason)| reason == "Nothing at $.refund")
        );
    }
}
