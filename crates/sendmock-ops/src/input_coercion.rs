use serde_json::{Map, Number, Value};

use crate::OperationError;
use crate::input_shape::{InputShape, ScalarType, describe_input_shape};

/// Builds an operation's JSON input from text values (query strings, path segments, CLI
/// flags), converted to the types its input schema names. A repeated name builds a list.
pub fn build_input_from_text(
    input_schema: &Value,
    text_values: &[(String, String)],
) -> Result<Map<String, Value>, OperationError> {
    let mut input = Map::new();
    for (input_name, text_value) in text_values {
        let input_shape = input_schema
            .pointer(&format!("/properties/{input_name}"))
            .map_or(InputShape::Scalar(ScalarType::Text), |property_schema| {
                describe_input_shape(property_schema, input_schema)
            });
        match input_shape {
            InputShape::Scalar(scalar_type) => {
                input.insert(
                    input_name.clone(),
                    convert_scalar(input_name, text_value, scalar_type)?,
                );
            }
            InputShape::List(item_type) => {
                let list_value = input
                    .entry(input_name.clone())
                    .or_insert_with(|| Value::Array(Vec::new()));
                if let Value::Array(items) = list_value {
                    items.push(convert_scalar(input_name, text_value, item_type)?);
                }
            }
            InputShape::Object => {
                let object_value = serde_json::from_str(text_value).map_err(|parse_error| {
                    invalid_input(
                        input_name,
                        &format!("`{input_name}` must be JSON: {parse_error}"),
                    )
                })?;
                input.insert(input_name.clone(), object_value);
            }
        }
    }
    Ok(input)
}

fn convert_scalar(
    input_name: &str,
    text_value: &str,
    scalar_type: ScalarType,
) -> Result<Value, OperationError> {
    match scalar_type {
        ScalarType::Text => Ok(Value::String(text_value.to_owned())),
        ScalarType::Boolean => match text_value {
            "true" | "1" => Ok(Value::Bool(true)),
            "false" | "0" => Ok(Value::Bool(false)),
            _ => Err(invalid_input(
                input_name,
                &format!("`{input_name}` must be true or false"),
            )),
        },
        ScalarType::Integer => text_value.parse::<i64>().map(Value::from).map_err(|_| {
            invalid_input(
                input_name,
                &format!("`{input_name}` must be a whole number"),
            )
        }),
        ScalarType::Number => text_value
            .parse::<f64>()
            .ok()
            .and_then(Number::from_f64)
            .map(Value::Number)
            .ok_or_else(|| invalid_input(input_name, &format!("`{input_name}` must be a number"))),
    }
}

fn invalid_input(input_name: &str, message: &str) -> OperationError {
    OperationError::InvalidInput {
        message: message.to_owned(),
        field: Some(input_name.to_owned()),
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn text_values(pairs: &[(&str, &str)]) -> Vec<(String, String)> {
        pairs
            .iter()
            .map(|(name, value)| ((*name).to_owned(), (*value).to_owned()))
            .collect()
    }

    fn email_list_schema() -> Value {
        json!({
            "properties": {
                "limit": { "type": "integer" },
                "is_unread": { "type": "boolean" },
                "tags": { "type": "array", "items": { "type": "string" } },
                "headers": { "type": "object" }
            }
        })
    }

    #[test]
    fn converts_text_to_the_schema_types() -> Result<(), OperationError> {
        let input = build_input_from_text(
            &email_list_schema(),
            &text_values(&[
                ("limit", "50"),
                ("is_unread", "true"),
                ("tags", "signup"),
                ("tags", "qa"),
                ("headers", r#"{"X-Order":"1042"}"#),
                ("query", "reset"),
            ]),
        )?;

        assert_eq!(
            Value::Object(input),
            json!({
                "limit": 50,
                "is_unread": true,
                "tags": ["signup", "qa"],
                "headers": { "X-Order": "1042" },
                "query": "reset"
            })
        );
        Ok(())
    }

    #[test]
    fn names_the_input_that_has_the_wrong_type() {
        let conversion_result =
            build_input_from_text(&email_list_schema(), &text_values(&[("limit", "many")]));

        assert!(matches!(
            conversion_result,
            Err(OperationError::InvalidInput { field: Some(field_name), .. }) if field_name == "limit"
        ));
    }
}
