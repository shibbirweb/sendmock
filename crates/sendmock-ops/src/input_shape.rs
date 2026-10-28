use serde_json::Value;

/// The type of one value: text, a switch, a whole number or a number.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScalarType {
    Text,
    Boolean,
    Integer,
    Number,
}

/// How an input is passed on the CLI or in a query string: one value, a repeated value,
/// or JSON for anything nested.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InputShape {
    Scalar(ScalarType),
    List(ScalarType),
    Object,
}

/// Reads an input property's shape from the operation's JSON Schema, following local
/// `$ref`s and skipping the `null` of optional values.
pub fn describe_input_shape(property_schema: &Value, root_schema: &Value) -> InputShape {
    let resolved_schema = resolve_schema(property_schema, root_schema);
    if let Some(item_schema) = resolved_schema.get("items") {
        return match describe_input_shape(item_schema, root_schema) {
            InputShape::Scalar(scalar_type) => InputShape::List(scalar_type),
            InputShape::List(_) | InputShape::Object => InputShape::Object,
        };
    }
    match read_type_name(resolved_schema) {
        Some("boolean") => InputShape::Scalar(ScalarType::Boolean),
        Some("integer") => InputShape::Scalar(ScalarType::Integer),
        Some("number") => InputShape::Scalar(ScalarType::Number),
        Some("object") => InputShape::Object,
        _ if resolved_schema.get("properties").is_some() => InputShape::Object,
        _ => InputShape::Scalar(ScalarType::Text),
    }
}

fn read_type_name(schema: &Value) -> Option<&str> {
    match schema.get("type")? {
        Value::String(type_name) => Some(type_name),
        Value::Array(type_names) => type_names
            .iter()
            .filter_map(Value::as_str)
            .find(|type_name| *type_name != "null"),
        _ => None,
    }
}

fn resolve_schema<'schema>(schema: &'schema Value, root_schema: &'schema Value) -> &'schema Value {
    if let Some(reference) = schema.get("$ref").and_then(Value::as_str) {
        let definition_name = reference.rsplit('/').next().unwrap_or_default();
        return root_schema
            .pointer(&format!("/$defs/{definition_name}"))
            .map_or(schema, |definition| resolve_schema(definition, root_schema));
    }
    let variants = schema.get("anyOf").or_else(|| schema.get("oneOf"));
    if let Some(Value::Array(variants)) = variants {
        let non_null_variant = variants.iter().find(|variant| {
            read_type_name(variant) != Some("null") || variant.get("$ref").is_some()
        });
        if let Some(variant) = non_null_variant {
            return resolve_schema(variant, root_schema);
        }
    }
    schema
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn shape_of(property_name: &str, root_schema: &Value) -> InputShape {
        describe_input_shape(&root_schema["properties"][property_name], root_schema)
    }

    #[test]
    fn reads_scalars_lists_and_objects() {
        let root_schema = json!({
            "properties": {
                "limit": { "type": ["integer", "null"] },
                "is_unread": { "type": "boolean" },
                "query": { "type": "string" },
                "tags": { "type": "array", "items": { "type": "string" } },
                "headers": { "type": "object" },
                "attachments": { "type": "array", "items": { "$ref": "#/$defs/Attachment" } },
                "direction": { "anyOf": [{ "$ref": "#/$defs/Direction" }, { "type": "null" }] }
            },
            "$defs": {
                "Attachment": { "type": "object", "properties": { "filename": { "type": "string" } } },
                "Direction": { "type": "string", "enum": ["outbound", "inbound"] }
            }
        });

        assert_eq!(
            shape_of("limit", &root_schema),
            InputShape::Scalar(ScalarType::Integer)
        );
        assert_eq!(
            shape_of("is_unread", &root_schema),
            InputShape::Scalar(ScalarType::Boolean)
        );
        assert_eq!(
            shape_of("query", &root_schema),
            InputShape::Scalar(ScalarType::Text)
        );
        assert_eq!(
            shape_of("tags", &root_schema),
            InputShape::List(ScalarType::Text)
        );
        assert_eq!(shape_of("headers", &root_schema), InputShape::Object);
        assert_eq!(shape_of("attachments", &root_schema), InputShape::Object);
        assert_eq!(
            shape_of("direction", &root_schema),
            InputShape::Scalar(ScalarType::Text)
        );
    }
}
