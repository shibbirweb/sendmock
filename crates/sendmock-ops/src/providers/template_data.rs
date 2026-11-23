use serde_json::{Map, Value};

/// One JSON object from the values the `template_data` part read, in mapping order. A key
/// several sources give keeps the first source's value, as Mailgun lets `t:variables`
/// override `X-Mailgun-Variables`; values that are not JSON objects are skipped.
pub fn merge_template_data(part_values: &[String]) -> Option<Map<String, Value>> {
    let mut template_data = Map::new();
    for part_value in part_values {
        if let Ok(Value::Object(data_object)) = serde_json::from_str::<Value>(part_value) {
            for (data_key, data_value) in data_object {
                template_data.entry(data_key).or_insert(data_value);
            }
        }
    }
    (!template_data.is_empty()).then_some(template_data)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn merge(part_values: &[&str]) -> Option<Value> {
        let owned_values: Vec<String> = part_values
            .iter()
            .map(|value| (*value).to_owned())
            .collect();
        merge_template_data(&owned_values).map(Value::Object)
    }

    // AC: EM-24.6
    #[test]
    fn the_first_source_wins_a_key_both_give_and_the_others_fill_the_rest() {
        assert_eq!(
            merge(&[
                r#"{"first_name": "Pat"}"#,
                r#"{"first_name": "Sam", "plan": "pro"}"#,
            ]),
            Some(json!({ "first_name": "Pat", "plan": "pro" }))
        );
    }

    #[test]
    fn values_that_are_not_json_objects_give_no_data() {
        assert_eq!(merge(&["not json", "[1, 2]"]), None);
        assert_eq!(merge(&[]), None);
    }
}
