use schemars::{JsonSchema, Schema, SchemaGenerator};

/// The schema of a field that is always present but may be `null`, as the contract writes it
/// (`type: [T, "null"]`, listed as required). `#[schemars(required)]` alone drops the `null`,
/// so such fields use `#[schemars(required, schema_with = "crate::nullable_schema::<T>")]`.
pub fn nullable_schema<T: JsonSchema>(schema_generator: &mut SchemaGenerator) -> Schema {
    Option::<T>::json_schema(schema_generator)
}

#[cfg(test)]
mod tests {
    use schemars::JsonSchema;
    use serde_json::json;

    #[derive(JsonSchema)]
    #[allow(dead_code, reason = "only its schema is read")]
    struct NumberForm {
        number: String,
        #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
        inbound_url: Option<String>,
    }

    #[test]
    fn a_nullable_field_stays_required_and_accepts_null() {
        let form_schema = schemars::schema_for!(NumberForm);

        assert_eq!(
            form_schema.get("required"),
            Some(&json!(["number", "inbound_url"]))
        );
        assert_eq!(
            form_schema
                .get("properties")
                .map(|properties| &properties["inbound_url"]),
            Some(&json!({ "type": ["string", "null"] }))
        );
    }
}
