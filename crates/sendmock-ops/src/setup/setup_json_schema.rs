use schemars::generate::SchemaSettings;
use serde_json::{Map, Value, json};

use super::setup_header::{CURRENT_FORMAT_VERSION, HEADER_KEY, SETUP_FORMAT_NAME};
use crate::seed::seed_section_adapters;

/// Where the website publishes each format version's schema.
const SCHEMA_BASE_URL: &str = "https://shibbir.me/sendmock/schema/setup";

/// The published address of a format version's schema, such as `.../schema/setup/v2.json`.
pub fn setup_json_schema_url(format_version: i64) -> String {
    format!("{SCHEMA_BASE_URL}/v{format_version}.json")
}

/// The JSON Schema of the format version this build writes, built from each section's item
/// type, so editors and AI agents can check a setup file while it is written. It describes
/// the one structure all three formats share.
pub fn build_setup_json_schema() -> Value {
    let mut schema_generator = SchemaSettings::draft2020_12().into_generator();
    let mut section_properties = Map::new();
    section_properties.insert(HEADER_KEY.to_owned(), describe_header());
    for section_adapter in seed_section_adapters() {
        let seed_section = section_adapter.section();
        let item_schema = section_adapter
            .describe_item_schema(&mut schema_generator)
            .to_value();
        let section_schema = if seed_section.is_item_list {
            json!({
                "type": "array",
                "items": item_schema,
            })
        } else {
            item_schema
        };
        insert_section_schema(
            &mut section_properties,
            seed_section.section_path,
            section_schema,
        );
    }
    let mut setup_schema = json!({
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": setup_json_schema_url(CURRENT_FORMAT_VERSION),
        "title": format!("SendMock setup file, format {CURRENT_FORMAT_VERSION}"),
        "description": "A SendMock setup: configuration to share or move between instances, in TOML, JSON or YAML. Strings may be ${ENV_VAR} references.",
        "type": "object",
        "required": [HEADER_KEY],
        "properties": section_properties,
        "additionalProperties": false,
        "$defs": schema_generator.take_definitions(true),
    });
    release_nullable_keys(&mut setup_schema);
    setup_schema
}

/// TOML has no null, so a setup leaves a key that may be null out instead; the API's
/// "always present, maybe null" keys are therefore never required in a setup.
fn release_nullable_keys(schema_part: &mut Value) {
    if let Some(schema_object) = schema_part.as_object_mut() {
        let nullable_keys: Vec<String> = schema_object
            .get("properties")
            .and_then(Value::as_object)
            .map(|properties| {
                properties
                    .iter()
                    .filter(|(_, property_schema)| accepts_null(property_schema))
                    .map(|(key, _)| key.clone())
                    .collect()
            })
            .unwrap_or_default();
        if let Some(required_keys) = schema_object
            .get_mut("required")
            .and_then(Value::as_array_mut)
        {
            required_keys.retain(|required_key| {
                !nullable_keys
                    .iter()
                    .any(|nullable_key| required_key.as_str() == Some(nullable_key))
            });
        }
    }
    match schema_part {
        Value::Object(schema_object) => schema_object.values_mut().for_each(release_nullable_keys),
        Value::Array(schema_items) => schema_items.iter_mut().for_each(release_nullable_keys),
        _ => {}
    }
}

fn accepts_null(property_schema: &Value) -> bool {
    let is_null_type = |type_value: &Value| match type_value {
        Value::String(type_name) => type_name == "null",
        Value::Array(type_names) => type_names.iter().any(|type_name| type_name == "null"),
        _ => false,
    };
    property_schema.get("type").is_some_and(is_null_type)
        || ["anyOf", "oneOf"].iter().any(|combinator| {
            property_schema
                .get(*combinator)
                .and_then(Value::as_array)
                .is_some_and(|alternatives| alternatives.iter().any(accepts_null))
        })
}

fn describe_header() -> Value {
    json!({
        "description": "Names the format and the format version, which changes only when a section or key changes shape.",
        "type": "object",
        "required": ["format", "format_version"],
        "properties": {
            "format": { "const": SETUP_FORMAT_NAME },
            "format_version": { "const": CURRENT_FORMAT_VERSION },
            "exported_by": {
                "description": "The SendMock release that wrote the file.",
                "type": "string",
            },
            "exported_at": {
                "description": "When the file was written, in RFC 3339.",
                "type": "string",
            },
        },
        "additionalProperties": false,
    })
}

/// Puts the section's schema at its path, inside a group object for `webhook.endpoints`.
fn insert_section_schema(
    section_properties: &mut Map<String, Value>,
    section_path: &str,
    section_schema: Value,
) {
    let Some((group_name, section_name)) = section_path.split_once('.') else {
        section_properties.insert(section_path.to_owned(), section_schema);
        return;
    };
    let group_schema = section_properties
        .entry(group_name.to_owned())
        .or_insert_with(|| {
            json!({
                "type": "object",
                "properties": {},
                "additionalProperties": false,
            })
        });
    if let Some(group_properties) = group_schema["properties"].as_object_mut() {
        group_properties.insert(section_name.to_owned(), section_schema);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn find_section_schema<'schema>(
        setup_schema: &'schema Value,
        section_path: &str,
    ) -> &'schema Value {
        match section_path.split_once('.') {
            Some((group_name, section_name)) => {
                &setup_schema["properties"][group_name]["properties"][section_name]
            }
            None => &setup_schema["properties"][section_path],
        }
    }

    // AC: PL-18.5
    #[test]
    fn a_key_that_may_be_null_is_never_required() {
        let mut item_schema = json!({
            "type": "object",
            "required": ["name", "method", "filter"],
            "properties": {
                "name": { "type": "string" },
                "method": { "type": ["string", "null"] },
                "filter": { "anyOf": [{ "$ref": "#/$defs/RuleFilter" }, { "type": "null" }] },
            },
        });

        release_nullable_keys(&mut item_schema);

        assert_eq!(item_schema["required"], json!(["name"]));
    }

    // AC: PL-18.5
    #[test]
    fn describes_every_section_with_its_item_shape() {
        let setup_schema = build_setup_json_schema();

        for section_adapter in seed_section_adapters() {
            let seed_section = section_adapter.section();
            let section_schema = find_section_schema(&setup_schema, seed_section.section_path);
            assert!(
                section_schema.is_object(),
                "{} has no schema",
                seed_section.section_path
            );
            if seed_section.is_item_list {
                assert_eq!(
                    section_schema["type"], "array",
                    "{}",
                    seed_section.section_path
                );
            }
        }
        assert_eq!(setup_schema["additionalProperties"], false);
        assert_eq!(
            setup_schema["properties"]["sendmock"]["properties"]["format_version"]["const"],
            CURRENT_FORMAT_VERSION
        );
    }

    #[test]
    fn refers_to_item_types_defined_once() {
        let setup_schema = build_setup_json_schema();

        assert_eq!(
            setup_schema["properties"]["email"]["properties"]["tag_rules"]["items"]["$ref"],
            "#/$defs/SeedTagRule"
        );
        assert_eq!(
            setup_schema["$defs"]["SeedTagRule"]["additionalProperties"],
            false
        );
        assert_eq!(
            setup_schema["$id"],
            "https://shibbir.me/sendmock/schema/setup/v2.json"
        );
    }
}
