//! Everything a template can read, as a tree built from sample values, with the functions and
//! filters it can call. The descriptions, functions and filters are exported from the UI
//! (`web/scripts/export-builtin-definitions.ts`), so the mock and the binary show one reference.

use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use serde_json::Value;

const REFERENCE_JSON: &str = include_str!("../../builtin/webhook-template-reference.json");
const EXAMPLE_LENGTH_LIMIT: usize = 60;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum TemplateValueType {
    String,
    Number,
    Boolean,
    Timestamp,
    Object,
    List,
}

/// One value a template can read, e.g. `data.to[0].address`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct TemplateReferenceField {
    pub path: String,
    /// The last part of the path, shown in the tree.
    pub name: String,
    pub value_type: TemplateValueType,
    pub description: String,
    /// From the preview sample; secrets come masked.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub example: Option<String>,
    pub children: Vec<TemplateReferenceField>,
}

/// A function or filter, with how to call it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct TemplateReferenceHelper {
    pub name: String,
    pub signature: String,
    pub description: String,
    pub example: String,
}

/// Every value a template can read for the chosen events, with its functions and filters.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct TemplateReference {
    pub fields: Vec<TemplateReferenceField>,
    pub functions: Vec<TemplateReferenceHelper>,
    pub filters: Vec<TemplateReferenceHelper>,
}

/// The shipped descriptions by path (list items as `[]`), functions and filters.
#[derive(Debug, Default, Deserialize)]
pub struct ReferenceCatalogue {
    pub field_descriptions: BTreeMap<String, String>,
    pub functions: Vec<TemplateReferenceHelper>,
    pub filters: Vec<TemplateReferenceHelper>,
}

pub fn load_reference_catalogue() -> ReferenceCatalogue {
    serde_json::from_str(REFERENCE_JSON).unwrap_or_default()
}

fn is_timestamp_text(text: &str) -> bool {
    let text_bytes = text.as_bytes();
    text_bytes.len() > 10
        && text_bytes[..10].iter().enumerate().all(|(index, byte)| {
            if index == 4 || index == 7 {
                *byte == b'-'
            } else {
                byte.is_ascii_digit()
            }
        })
        && text_bytes[10] == b'T'
}

fn read_value_type(sample_value: &Value) -> TemplateValueType {
    match sample_value {
        Value::Array(_) => TemplateValueType::List,
        Value::Object(_) => TemplateValueType::Object,
        Value::Number(_) => TemplateValueType::Number,
        Value::Bool(_) => TemplateValueType::Boolean,
        Value::String(text) if is_timestamp_text(text) => TemplateValueType::Timestamp,
        Value::String(_) | Value::Null => TemplateValueType::String,
    }
}

fn to_example(sample_value: &Value) -> Option<String> {
    let example_text = match sample_value {
        Value::String(text) => text.clone(),
        Value::Number(number) => number.to_string(),
        Value::Bool(flag) => flag.to_string(),
        Value::Null | Value::Array(_) | Value::Object(_) => return None,
    };
    if example_text.chars().count() > EXAMPLE_LENGTH_LIMIT {
        let shortened_text: String = example_text.chars().take(EXAMPLE_LENGTH_LIMIT).collect();
        return Some(format!("{shortened_text}..."));
    }
    Some(example_text)
}

/// `data.to[0].address` becomes `data.to[].address`, the key of the descriptions.
fn to_description_key(field_path: &str) -> String {
    let mut description_key = String::with_capacity(field_path.len());
    let mut is_inside_index = false;
    for character in field_path.chars() {
        match character {
            '[' => {
                is_inside_index = true;
                description_key.push('[');
            }
            ']' => {
                is_inside_index = false;
                description_key.push(']');
            }
            _ if is_inside_index => {}
            _ => description_key.push(character),
        }
    }
    description_key
}

/// A field and its children from a sample value; a list shows its first item as `[0]`.
pub fn build_reference_field(
    field_path: &str,
    field_name: &str,
    sample_value: &Value,
    field_descriptions: &BTreeMap<String, String>,
) -> TemplateReferenceField {
    let children = match sample_value {
        Value::Object(sample_fields) => sample_fields
            .iter()
            .map(|(child_name, child_value)| {
                let child_path = format!("{field_path}.{child_name}");
                build_reference_field(&child_path, child_name, child_value, field_descriptions)
            })
            .collect(),
        Value::Array(sample_items) => sample_items
            .first()
            .map(|first_item| {
                let item_path = format!("{field_path}[0]");
                vec![build_reference_field(
                    &item_path,
                    "[0]",
                    first_item,
                    field_descriptions,
                )]
            })
            .unwrap_or_default(),
        _ => Vec::new(),
    };
    TemplateReferenceField {
        path: field_path.to_owned(),
        name: field_name.to_owned(),
        value_type: read_value_type(sample_value),
        description: field_descriptions
            .get(&to_description_key(field_path))
            .cloned()
            .unwrap_or_default(),
        example: to_example(sample_value),
        children,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn the_shipped_catalogue_loads() {
        let reference_catalogue = load_reference_catalogue();

        assert!(!reference_catalogue.functions.is_empty());
        assert!(!reference_catalogue.filters.is_empty());
        assert!(
            reference_catalogue
                .field_descriptions
                .contains_key("data.to[].address")
        );
    }

    #[test]
    fn a_list_shows_its_first_item_with_the_list_items_description() {
        let field_descriptions =
            BTreeMap::from([("data.to[].address".to_owned(), "Recipient.".to_owned())]);

        let to_field = build_reference_field(
            "data.to",
            "to",
            &json!([{ "address": "ann@example.com" }]),
            &field_descriptions,
        );

        let address_field = &to_field.children[0].children[0];
        assert_eq!(to_field.value_type, TemplateValueType::List);
        assert_eq!(address_field.path, "data.to[0].address");
        assert_eq!(address_field.description, "Recipient.");
        assert_eq!(address_field.example.as_deref(), Some("ann@example.com"));
    }

    #[test]
    fn values_get_their_type_and_a_short_example() {
        let long_text = "x".repeat(80);

        let created_field = build_reference_field(
            "created_at",
            "created_at",
            &json!("2026-10-25T09:30:00Z"),
            &BTreeMap::new(),
        );
        let long_field = build_reference_field("body", "body", &json!(long_text), &BTreeMap::new());

        assert_eq!(created_field.value_type, TemplateValueType::Timestamp);
        assert_eq!(
            long_field.example,
            Some(format!("{}...", "x".repeat(EXAMPLE_LENGTH_LIMIT)))
        );
    }
}
