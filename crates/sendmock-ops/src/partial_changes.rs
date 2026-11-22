use std::borrow::Cow;
use std::marker::PhantomData;

use schemars::{JsonSchema, Schema, SchemaGenerator};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::{Map, Value};

use crate::OperationError;

/// The fields a PATCH body gives for a stored object of type `Full`: the rest keep their
/// stored values. Objects merge key by key and anything else is replaced, as a JSON merge
/// patch does (RFC 7386), except that `null` sets a field to null instead of removing it.
#[derive(Debug, Clone, PartialEq)]
pub struct PartialChanges<Full> {
    given_fields: Map<String, Value>,
    full_type: PhantomData<Full>,
}

impl<Full: DeserializeOwned> PartialChanges<Full> {
    /// The stored object with the given fields merged in, read back as `Full`, so the type's
    /// own checks name a field that does not fit. `stored` is anything whose fields carry the
    /// same names as `Full`'s, such as `Full` itself or the object's API answer; fields `Full`
    /// does not have are ignored, as the API ignores them in a request.
    pub fn merge_onto<Stored: Serialize>(&self, stored: &Stored) -> Result<Full, OperationError> {
        let mut merged_value = serde_json::to_value(stored)
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
        merge_fields(&mut merged_value, &self.given_fields);
        serde_json::from_value(merged_value).map_err(|read_error| OperationError::InvalidInput {
            message: read_error.to_string(),
            field: None,
        })
    }

    pub fn is_given(&self, field_name: &str) -> bool {
        self.given_fields.contains_key(field_name)
    }
}

fn merge_fields(target_value: &mut Value, given_fields: &Map<String, Value>) {
    let Value::Object(target_fields) = target_value else {
        *target_value = Value::Object(given_fields.clone());
        return;
    };
    for (field_name, given_value) in given_fields {
        match (target_fields.get_mut(field_name), given_value) {
            (Some(target_field @ Value::Object(_)), Value::Object(nested_fields)) => {
                merge_fields(target_field, nested_fields);
            }
            _ => {
                target_fields.insert(field_name.clone(), given_value.clone());
            }
        }
    }
}

impl<Full> Default for PartialChanges<Full> {
    /// No fields given: a merge answers the stored object as it is.
    fn default() -> Self {
        Self {
            given_fields: Map::new(),
            full_type: PhantomData,
        }
    }
}

impl<'de, Full> Deserialize<'de> for PartialChanges<Full> {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        Ok(Self {
            given_fields: Map::deserialize(deserializer)?,
            full_type: PhantomData,
        })
    }
}

impl<Full: JsonSchema> JsonSchema for PartialChanges<Full> {
    fn schema_name() -> Cow<'static, str> {
        format!("Partial{}", Full::schema_name()).into()
    }

    fn inline_schema() -> bool {
        true
    }

    /// `Full`'s fields, none of them required.
    fn json_schema(schema_generator: &mut SchemaGenerator) -> Schema {
        let mut schema = Full::json_schema(schema_generator);
        schema.remove("required");
        schema
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
    struct StoredThing {
        name: String,
        is_enabled: bool,
        limits: Limits,
        tags: Vec<String>,
        note: Option<String>,
    }

    #[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
    struct Limits {
        per_minute: u32,
        per_day: u32,
    }

    fn stored_thing() -> StoredThing {
        StoredThing {
            name: "Shop".to_owned(),
            is_enabled: true,
            limits: Limits {
                per_minute: 10,
                per_day: 100,
            },
            tags: vec!["a".to_owned(), "b".to_owned()],
            note: Some("kept".to_owned()),
        }
    }

    fn read_changes(changes_json: Value) -> PartialChanges<StoredThing> {
        serde_json::from_value(changes_json).unwrap_or_else(|error| panic!("{error}"))
    }

    // AC: PL-26.4
    #[test]
    fn a_partial_body_changes_only_its_fields() -> Result<(), OperationError> {
        let changes =
            read_changes(serde_json::json!({ "is_enabled": false, "limits": { "per_day": 5 } }));

        let merged = changes.merge_onto(&stored_thing())?;

        assert!(!merged.is_enabled);
        assert_eq!(
            merged.limits,
            Limits {
                per_minute: 10,
                per_day: 5
            }
        );
        assert_eq!(merged.name, "Shop");
        assert_eq!(merged.note.as_deref(), Some("kept"));
        Ok(())
    }

    #[test]
    fn a_list_is_replaced_and_null_clears_an_optional_field() -> Result<(), OperationError> {
        let changes = read_changes(serde_json::json!({ "tags": ["c"], "note": null }));

        let merged = changes.merge_onto(&stored_thing())?;

        assert_eq!(merged.tags, vec!["c".to_owned()]);
        assert_eq!(merged.note, None);
        Ok(())
    }

    #[test]
    fn a_field_of_the_wrong_type_is_refused_by_name() {
        let changes = read_changes(serde_json::json!({ "is_enabled": "yes" }));

        let merge_error = changes
            .merge_onto(&stored_thing())
            .err()
            .map(|error| error.to_string())
            .unwrap_or_default();

        assert!(merge_error.contains("invalid type"), "{merge_error}");
    }

    #[test]
    fn the_schema_has_the_fields_and_requires_none() {
        let schema = schemars::schema_for!(PartialChanges<StoredThing>);
        let schema_json = serde_json::to_value(&schema).unwrap_or_default();

        assert!(
            schema_json["properties"]["name"].is_object(),
            "{schema_json}"
        );
        assert!(schema_json.get("required").is_none(), "{schema_json}");
    }
}
