//! `{{ path }}` placeholders over earlier steps' saved outputs, and `assert` comparisons.

use serde_json::{Map, Value};

fn read_path(saved_values: &Map<String, Value>, value_path: &str) -> Value {
    let mut path_parts = value_path.split('.');
    let Some(first_part) = path_parts.next() else {
        return Value::Null;
    };
    path_parts.fold(
        saved_values.get(first_part).cloned().unwrap_or(Value::Null),
        |current_value, path_part| match (&current_value, path_part.parse::<usize>()) {
            (Value::Array(items), Ok(item_index)) => {
                items.get(item_index).cloned().unwrap_or(Value::Null)
            }
            _ => current_value.get(path_part).cloned().unwrap_or(Value::Null),
        },
    )
}

/// `path` or `path | length`.
fn evaluate_expression(saved_values: &Map<String, Value>, expression_text: &str) -> Value {
    let mut expression_parts = expression_text.split('|').map(str::trim);
    let path_value = read_path(saved_values, expression_parts.next().unwrap_or_default());
    match expression_parts.next() {
        Some("length") => Value::from(match &path_value {
            Value::Array(items) => items.len(),
            Value::String(text) => text.chars().count(),
            _ => 0,
        }),
        _ => path_value,
    }
}

fn to_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Null => String::new(),
        other_value => other_value.to_string(),
    }
}

/// Fills `{{ ... }}` in text; text that is one placeholder keeps the value's type.
pub fn fill_template(saved_values: &Map<String, Value>, template_text: &str) -> Value {
    let trimmed_text = template_text.trim();
    if let Some(expression_text) = trimmed_text
        .strip_prefix("{{")
        .and_then(|rest| rest.strip_suffix("}}"))
        && !expression_text.contains("{{")
    {
        return evaluate_expression(saved_values, expression_text);
    }
    let mut filled_text = String::new();
    let mut remaining_text = template_text;
    while let Some(placeholder_start) = remaining_text.find("{{") {
        let Some(placeholder_length) = remaining_text[placeholder_start..].find("}}") else {
            break;
        };
        filled_text.push_str(&remaining_text[..placeholder_start]);
        let expression_text =
            &remaining_text[placeholder_start + 2..placeholder_start + placeholder_length];
        filled_text.push_str(&to_text(&evaluate_expression(
            saved_values,
            expression_text,
        )));
        remaining_text = &remaining_text[placeholder_start + placeholder_length + 2..];
    }
    filled_text.push_str(remaining_text);
    Value::String(filled_text)
}

/// Fills every string inside a step's `with` table.
pub fn fill_step_input(saved_values: &Map<String, Value>, step_input: &Value) -> Value {
    match step_input {
        Value::String(text) => fill_template(saved_values, text),
        Value::Array(items) => Value::Array(
            items
                .iter()
                .map(|item| fill_step_input(saved_values, item))
                .collect(),
        ),
        Value::Object(fields) => Value::Object(
            fields
                .iter()
                .map(|(key, value)| (key.clone(), fill_step_input(saved_values, value)))
                .collect(),
        ),
        other_value => other_value.clone(),
    }
}

const COMPARISON_OPERATORS: [&str; 6] = ["==", "!=", ">=", "<=", ">", "<"];

/// An `assert` step's `that`: a comparison of two filled values (numbers when both are), or
/// a value that is not empty, `false` or `0`.
pub fn evaluate_assertion(filled_text: &str) -> bool {
    let trimmed_text = filled_text.trim();
    let comparison = COMPARISON_OPERATORS
        .iter()
        .filter_map(|operator| {
            trimmed_text
                .find(operator)
                .map(|operator_index| (operator_index, *operator))
        })
        .min_by_key(|(operator_index, operator)| {
            (*operator_index, std::cmp::Reverse(operator.len()))
        });
    let Some((operator_index, operator)) = comparison else {
        return !matches!(trimmed_text, "" | "false" | "0");
    };
    let left_text = trimmed_text[..operator_index].trim();
    let right_text = trimmed_text[operator_index + operator.len()..].trim();
    let ordering = match (left_text.parse::<f64>(), right_text.parse::<f64>()) {
        (Ok(left_number), Ok(right_number)) => left_number.partial_cmp(&right_number),
        _ => Some(left_text.cmp(right_text)),
    };
    let Some(ordering) = ordering else {
        return false;
    };
    match operator {
        "==" => ordering.is_eq(),
        "!=" => ordering.is_ne(),
        ">=" => ordering.is_ge(),
        "<=" => ordering.is_le(),
        ">" => ordering.is_gt(),
        _ => ordering.is_lt(),
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    // AC: AI-04.1
    #[test]
    fn placeholders_read_saved_outputs_and_asserts_compare_them() {
        let saved_values =
            json!({ "endpoint": { "id": "01E" }, "deliveries": { "items": [1, 2] } });
        let saved_values = saved_values.as_object().cloned().unwrap_or_default();

        assert_eq!(
            fill_template(&saved_values, "{{ endpoint.id }}"),
            json!("01E")
        );
        assert_eq!(
            fill_template(&saved_values, "{{ deliveries.items | length }}"),
            json!(2)
        );
        assert_eq!(
            fill_template(&saved_values, "id={{ endpoint.id }}!"),
            json!("id=01E!")
        );
        assert!(evaluate_assertion("2 >= 1"));
        assert!(evaluate_assertion("sent == sent"));
        assert!(!evaluate_assertion("10 < 9"));
        assert!(!evaluate_assertion("0"));
    }
}
