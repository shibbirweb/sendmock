mod schema_components;

use sendmock_ops::{HttpMethod, OperationRegistry};
use serde_json::{Map, Value, json};

use schema_components::SchemaComponents;

const OPENAPI_VERSION: &str = "3.1.0";
const ERROR_BODY_SCHEMA_NAME: &str = "ApiErrorBody";

/// The OpenAPI 3.1 document for the operations this binary serves, built from the
/// registry so it can never describe a route that does not exist.
pub fn build_openapi_document(operation_registry: &OperationRegistry, version: &str) -> Value {
    let mut schema_components = SchemaComponents::default();
    schema_components.insert_schema(ERROR_BODY_SCHEMA_NAME, error_body_schema());
    let mut paths = Map::new();
    for operation in operation_registry.operations() {
        let definition = operation.definition();
        let mut operation_object = json!({
            "operationId": definition.operation_id,
            "summary": definition.summary,
            "responses": {
                "200": {
                    "description": "OK.",
                    "content": json_content(&schema_components.add_root_schema(operation.output_schema())),
                },
                "default": {
                    "description": "An error.",
                    "content": json_content(&schema_reference(ERROR_BODY_SCHEMA_NAME)),
                },
            },
        });
        if matches!(
            definition.method,
            HttpMethod::Post | HttpMethod::Put | HttpMethod::Patch
        ) {
            operation_object["requestBody"] = json!({
                "required": true,
                "content": json_content(&schema_components.add_root_schema(operation.input_schema())),
            });
        }
        let path_item = paths.entry(definition.path).or_insert_with(|| json!({}));
        path_item[definition.method.as_str().to_lowercase()] = operation_object;
    }
    json!({
        "openapi": OPENAPI_VERSION,
        "info": { "title": "SendMock API", "version": version },
        "paths": paths,
        "components": { "schemas": schema_components.into_schemas() },
    })
}

pub fn schema_reference(schema_name: &str) -> Value {
    json!({ "$ref": format!("#/components/schemas/{schema_name}") })
}

fn json_content(schema: &Value) -> Value {
    json!({ "application/json": { "schema": schema } })
}

fn error_body_schema() -> Value {
    json!({
        "type": "object",
        "properties": {
            "error": {
                "type": "object",
                "properties": {
                    "code": { "type": "string" },
                    "message": { "type": "string" },
                    "field": { "type": "string" },
                },
                "required": ["code", "message"],
            },
        },
        "required": ["error"],
    })
}
