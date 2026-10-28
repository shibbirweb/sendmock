use schemars::Schema;
use serde_json::{Map, Value};

use super::schema_reference;

const SCHEMARS_DEFINITIONS_PREFIX: &str = "#/$defs/";
const COMPONENTS_PREFIX: &str = "#/components/schemas/";

/// Collects every named schema into `components.schemas`, rewriting `schemars`' local
/// `#/$defs/` references to point there.
#[derive(Default)]
pub struct SchemaComponents {
    schemas: Map<String, Value>,
}

impl SchemaComponents {
    pub fn insert_schema(&mut self, schema_name: &str, schema: Value) {
        self.schemas.insert(schema_name.to_owned(), schema);
    }

    /// Adds a type's schema and its definitions; returns a reference to it, or the schema
    /// itself when it has no name to file it under.
    pub fn add_root_schema(&mut self, root_schema: Schema) -> Value {
        let mut schema_value = root_schema.to_value();
        rewrite_references(&mut schema_value);
        let Some(schema_object) = schema_value.as_object_mut() else {
            return schema_value;
        };
        schema_object.remove("$schema");
        if let Some(Value::Object(definitions)) = schema_object.remove("$defs") {
            self.schemas.extend(definitions);
        }
        match schema_object
            .remove("title")
            .and_then(|title| title.as_str().map(str::to_owned))
        {
            Some(schema_name) => {
                self.schemas.insert(schema_name.clone(), schema_value);
                schema_reference(&schema_name)
            }
            None => schema_value,
        }
    }

    pub fn into_schemas(self) -> Map<String, Value> {
        self.schemas
    }
}

fn rewrite_references(schema_value: &mut Value) {
    match schema_value {
        Value::Object(schema_object) => {
            if let Some(Value::String(reference)) = schema_object.get_mut("$ref")
                && let Some(schema_name) = reference.strip_prefix(SCHEMARS_DEFINITIONS_PREFIX)
            {
                *reference = format!("{COMPONENTS_PREFIX}{schema_name}");
            }
            for nested_value in schema_object.values_mut() {
                rewrite_references(nested_value);
            }
        }
        Value::Array(items) => items.iter_mut().for_each(rewrite_references),
        _ => {}
    }
}
