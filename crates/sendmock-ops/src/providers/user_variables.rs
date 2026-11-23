use serde_json::{Map, Value};

/// The prefix of one user variable per field, as Mailgun's `v:order-id`.
const VARIABLE_FIELD_PREFIX: &str = "v:";

/// One JSON object from the values the `user_variables` part read: a JSON object (Mailgun's
/// `X-Mailgun-Variables`) adds its keys, and a `v:name: value` field adds one key, its value
/// read as JSON when it is JSON. Later values win; `None` when there are none.
pub fn read_user_variables(part_values: &[String]) -> Option<Map<String, Value>> {
    let mut user_variables = Map::new();
    for part_value in part_values {
        if let Ok(Value::Object(variable_object)) = serde_json::from_str::<Value>(part_value) {
            user_variables.extend(variable_object);
            continue;
        }
        let Some((field_name, field_value)) = part_value
            .strip_prefix(VARIABLE_FIELD_PREFIX)
            .and_then(|unprefixed_text| unprefixed_text.split_once(':'))
        else {
            continue;
        };
        let field_value = field_value.trim();
        let variable_value = serde_json::from_str::<Value>(field_value)
            .ok()
            .filter(|parsed_value| !parsed_value.is_string())
            .unwrap_or_else(|| Value::String(field_value.to_owned()));
        user_variables.insert(field_name.trim().to_owned(), variable_value);
    }
    (!user_variables.is_empty()).then_some(user_variables)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn read(part_values: &[&str]) -> Option<Value> {
        let owned_values: Vec<String> = part_values
            .iter()
            .map(|value| (*value).to_owned())
            .collect();
        read_user_variables(&owned_values).map(Value::Object)
    }

    // AC: EM-24.2
    #[test]
    fn v_fields_and_the_variables_header_become_one_object() {
        assert_eq!(
            read(&[
                r#"{"customer_id": 42, "plan": "pro"}"#,
                "v:order-id: A-1001",
                "v:retry: 2",
            ]),
            Some(json!({ "customer_id": 42, "plan": "pro", "order-id": "A-1001", "retry": 2 }))
        );
    }

    #[test]
    fn a_later_value_wins_and_nothing_gives_none() {
        assert_eq!(
            read(&[r#"{"plan": "free"}"#, "v:plan: pro"]),
            Some(json!({ "plan": "pro" }))
        );
        assert_eq!(read(&[]), None);
        assert_eq!(read(&["not a variable"]), None);
    }
}
