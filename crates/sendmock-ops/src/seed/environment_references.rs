use super::environment_reader::EnvironmentReader;

/// Replaces every `${NAME}` in the seed's strings with the variable's value. A variable that
/// is not set reads as empty and is named in the answer, so the caller can warn about it.
pub fn resolve_environment_references(
    seed_value: &mut toml::Value,
    environment_reader: &dyn EnvironmentReader,
    missing_variables: &mut Vec<String>,
) {
    match seed_value {
        toml::Value::String(text) => {
            if text.contains("${") {
                *text = resolve_text(text, environment_reader, missing_variables);
            }
        }
        toml::Value::Array(items) => {
            for item in items {
                resolve_environment_references(item, environment_reader, missing_variables);
            }
        }
        toml::Value::Table(table) => {
            for (_, table_value) in table.iter_mut() {
                resolve_environment_references(table_value, environment_reader, missing_variables);
            }
        }
        toml::Value::Integer(_)
        | toml::Value::Float(_)
        | toml::Value::Boolean(_)
        | toml::Value::Datetime(_) => {}
    }
}

fn resolve_text(
    text: &str,
    environment_reader: &dyn EnvironmentReader,
    missing_variables: &mut Vec<String>,
) -> String {
    let mut resolved_text = String::with_capacity(text.len());
    let mut remaining_text = text;
    while let Some(opening_index) = remaining_text.find("${") {
        resolved_text.push_str(&remaining_text[..opening_index]);
        let after_opening = &remaining_text[opening_index + 2..];
        let Some(closing_index) = after_opening.find('}') else {
            resolved_text.push_str(&remaining_text[opening_index..]);
            return resolved_text;
        };
        let variable_name = &after_opening[..closing_index];
        match environment_reader.read_variable(variable_name) {
            Some(variable_value) => resolved_text.push_str(&variable_value),
            None => {
                if !missing_variables
                    .iter()
                    .any(|missing| missing == variable_name)
                {
                    missing_variables.push(variable_name.to_owned());
                }
            }
        }
        remaining_text = &after_opening[closing_index + 1..];
    }
    resolved_text.push_str(remaining_text);
    resolved_text
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::seed::environment_reader::FixedEnvironment;

    #[test]
    fn replaces_references_in_nested_strings_and_names_missing_ones() {
        let environment = FixedEnvironment::default().with_variable("APP_SECRET", "whsec_abc");
        let mut seed_value: toml::Value = toml::from_str(
            "[[webhook.endpoints]]\nsecret = \"${APP_SECRET}\"\nurl = \"http://${APP_HOST}:8000/hook\"\nport = 25\n",
        )
        .unwrap_or_else(|error| panic!("a seed: {error}"));
        let mut missing_variables = Vec::new();

        resolve_environment_references(&mut seed_value, &environment, &mut missing_variables);

        let endpoint = &seed_value["webhook"]["endpoints"][0];
        assert_eq!(endpoint["secret"].as_str(), Some("whsec_abc"));
        assert_eq!(endpoint["url"].as_str(), Some("http://:8000/hook"));
        assert_eq!(missing_variables, ["APP_HOST"]);
    }
}
