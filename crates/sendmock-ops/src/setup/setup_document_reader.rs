use serde_yaml_ng::Value as PortableValue;

use super::setup_file_format::SetupFileFormat;
use super::setup_problem::{SetupProblem, join_location};
use crate::seed::SeedLineIndex;

/// Reads a setup file in any format into the one structure every section adapter reads: a
/// TOML table. JSON and YAML keys and values map one to one; a `null` value is left out, as
/// TOML has none and a missing key means the same.
pub fn read_setup_document(
    setup_text: &str,
    setup_format: SetupFileFormat,
) -> Result<toml::Table, SetupProblem> {
    match setup_format {
        SetupFileFormat::Toml => read_toml_document(setup_text),
        SetupFileFormat::Json => {
            // Read into a YAML value, whose mappings keep the file's key order.
            let portable_value: PortableValue =
                serde_json::from_str(setup_text).map_err(|parse_error| SetupProblem {
                    line: Some(parse_error.line()),
                    location: None,
                    message: strip_position(&parse_error.to_string()),
                })?;
            convert_top_level(portable_value)
        }
        SetupFileFormat::Yaml => {
            let portable_value: PortableValue =
                serde_yaml_ng::from_str(setup_text).map_err(|parse_error| SetupProblem {
                    line: parse_error.location().map(|location| location.line()),
                    location: None,
                    message: strip_position(&parse_error.to_string()),
                })?;
            convert_top_level(portable_value)
        }
    }
}

fn read_toml_document(setup_text: &str) -> Result<toml::Table, SetupProblem> {
    setup_text
        .parse::<toml::Table>()
        .map_err(|parse_error| SetupProblem {
            line: parse_error
                .span()
                .map(|span| SeedLineIndex::new(setup_text).line_of(span.start)),
            location: None,
            message: parse_error.message().to_owned(),
        })
}

/// The parsers end their messages with the position, which the problem already holds.
fn strip_position(parse_message: &str) -> String {
    parse_message
        .split_once(" at line ")
        .map_or(parse_message, |(message, _)| message)
        .to_owned()
}

fn convert_top_level(portable_value: PortableValue) -> Result<toml::Table, SetupProblem> {
    match portable_value {
        PortableValue::Null => Ok(toml::Table::new()),
        PortableValue::Mapping(_) => match convert_value(portable_value, "")? {
            Some(toml::Value::Table(setup_document)) => Ok(setup_document),
            _ => Ok(toml::Table::new()),
        },
        _ => Err(SetupProblem {
            line: Some(1),
            location: None,
            message: "A setup file holds its sections in one object at the top".to_owned(),
        }),
    }
}

fn describe_at(location: &str, message: String) -> SetupProblem {
    SetupProblem {
        line: None,
        location: (!location.is_empty()).then(|| location.to_owned()),
        message,
    }
}

/// The TOML value of a JSON or YAML value; `None` for `null`, which the caller leaves out.
fn convert_value(
    portable_value: PortableValue,
    location: &str,
) -> Result<Option<toml::Value>, SetupProblem> {
    let toml_value = match portable_value {
        PortableValue::Null => return Ok(None),
        PortableValue::Bool(flag) => toml::Value::Boolean(flag),
        PortableValue::Number(number) => convert_number(&number, location)?,
        PortableValue::String(text) => toml::Value::String(text),
        PortableValue::Sequence(items) => {
            let mut toml_items = Vec::with_capacity(items.len());
            for (item_index, item) in items.into_iter().enumerate() {
                let item_location = format!("{location}[{item_index}]");
                let Some(toml_item) = convert_value(item, &item_location)? else {
                    return Err(describe_at(
                        &item_location,
                        "A list cannot hold null; leave the item out".to_owned(),
                    ));
                };
                toml_items.push(toml_item);
            }
            toml::Value::Array(toml_items)
        }
        PortableValue::Mapping(mapping) => {
            let mut toml_table = toml::Table::new();
            for (mapping_key, mapping_value) in mapping {
                let key = convert_key(mapping_key, location)?;
                let value_location = join_location(location, &key);
                if let Some(toml_value) = convert_value(mapping_value, &value_location)? {
                    toml_table.insert(key, toml_value);
                }
            }
            toml::Value::Table(toml_table)
        }
        PortableValue::Tagged(tagged_value) => {
            return Err(describe_at(
                location,
                format!("YAML tags such as {} are not supported", tagged_value.tag),
            ));
        }
    };
    Ok(Some(toml_value))
}

fn convert_number(
    number: &serde_yaml_ng::Number,
    location: &str,
) -> Result<toml::Value, SetupProblem> {
    if let Some(integer) = number.as_i64() {
        return Ok(toml::Value::Integer(integer));
    }
    if number.is_f64()
        && let Some(float) = number.as_f64()
    {
        return Ok(toml::Value::Float(float));
    }
    Err(describe_at(
        location,
        format!(
            "{number} is too large; a whole number goes up to {}",
            i64::MAX
        ),
    ))
}

/// Keys are text; a YAML key written as a number or `true` is read as its text.
fn convert_key(mapping_key: PortableValue, location: &str) -> Result<String, SetupProblem> {
    match mapping_key {
        PortableValue::String(key) => Ok(key),
        PortableValue::Number(number) => Ok(number.to_string()),
        PortableValue::Bool(flag) => Ok(flag.to_string()),
        _ => Err(describe_at(
            location,
            "Each key must be text, a number or true or false".to_owned(),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read(setup_text: &str, setup_format: SetupFileFormat) -> toml::Table {
        read_setup_document(setup_text, setup_format)
            .unwrap_or_else(|problem| panic!("a setup: {problem:?}"))
    }

    // AC: PL-18.5
    #[test]
    fn reads_the_same_structure_from_every_format() {
        let from_toml = read(
            "[settings]\nmax_emails = 50\n\n[[webhook.endpoints]]\nname = \"App\"\nenabled = false\n",
            SetupFileFormat::Toml,
        );
        let from_json = read(
            r#"{"settings": {"max_emails": 50}, "webhook": {"endpoints": [{"name": "App", "enabled": false}]}}"#,
            SetupFileFormat::Json,
        );
        let from_yaml = read(
            "settings:\n  max_emails: 50\nwebhook:\n  endpoints:\n    - name: App\n      enabled: false\n",
            SetupFileFormat::Yaml,
        );

        assert_eq!(from_json, from_toml);
        assert_eq!(from_yaml, from_toml);
    }

    #[test]
    fn leaves_out_null_values_and_keeps_the_key_order() {
        let setup_document = read(
            "numbers:\n  - number: \"+15550001111\"\n    label: Support\n    inbound_url: null\nsettings: {}\n",
            SetupFileFormat::Yaml,
        );

        let keys: Vec<&String> = setup_document.keys().collect();
        assert_eq!(keys, ["numbers", "settings"]);
        let number_table = setup_document["numbers"][0]
            .as_table()
            .cloned()
            .unwrap_or_default();
        assert!(!number_table.contains_key("inbound_url"));
        assert_eq!(number_table["label"].as_str(), Some("Support"));
    }

    #[test]
    fn reads_an_empty_yaml_file_as_an_empty_setup() {
        assert!(read("", SetupFileFormat::Yaml).is_empty());
    }

    #[test]
    fn reports_a_syntax_error_on_its_line_without_repeating_the_position() {
        let json_problem = read_setup_document(
            "{\n  \"numbers\": [\n    oops\n  ]\n}\n",
            SetupFileFormat::Json,
        )
        .err()
        .unwrap_or_else(|| panic!("broken JSON is refused"));
        let yaml_problem =
            read_setup_document("numbers:\n  - number: 1\n bad: [\n", SetupFileFormat::Yaml)
                .err()
                .unwrap_or_else(|| panic!("broken YAML is refused"));

        assert_eq!(json_problem.line, Some(3));
        assert!(
            !json_problem.message.contains("at line"),
            "{json_problem:?}"
        );
        assert!(yaml_problem.line.is_some(), "{yaml_problem:?}");
    }

    #[test]
    fn names_the_key_path_of_a_value_toml_cannot_hold() {
        let problem = read_setup_document(
            r#"{"webhook": {"endpoints": [{"name": "App"}, null]}}"#,
            SetupFileFormat::Json,
        )
        .err()
        .unwrap_or_else(|| panic!("a null item is refused"));

        assert_eq!(problem.line, None);
        assert_eq!(problem.location.as_deref(), Some("webhook.endpoints[1]"));
    }

    #[test]
    fn refuses_a_file_that_is_not_an_object_of_sections() {
        let problem = read_setup_document("[1, 2]", SetupFileFormat::Json)
            .err()
            .unwrap_or_else(|| panic!("a list is refused"));

        assert!(problem.message.contains("one object at the top"));
    }
}
