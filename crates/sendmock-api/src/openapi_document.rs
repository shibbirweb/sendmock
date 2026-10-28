mod schema_components;

use sendmock_ops::{AnswerKind, ErasedOperation, HttpMethod, OperationRegistry, SuccessStatus};
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
        let operation_object = build_operation_object(operation.as_ref(), &mut schema_components);
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

fn build_operation_object(
    operation: &dyn ErasedOperation,
    schema_components: &mut SchemaComponents,
) -> Value {
    let definition = operation.definition();
    let input_reference = schema_components.add_root_schema(operation.input_schema());
    let input_schema = schema_components.resolve(&input_reference);
    let path_input_names: Vec<String> = definition
        .path_parameter_names()
        .into_iter()
        .map(|(_, input_name)| input_name)
        .collect();
    let mut operation_object = json!({
        "operationId": definition.operation_id,
        "summary": definition.summary,
        "responses": {
            definition.success_status.code().to_string(): build_success_response(operation, schema_components),
            "default": {
                "description": "An error.",
                "content": json_content(&schema_reference(ERROR_BODY_SCHEMA_NAME)),
            },
        },
    });
    let has_body = matches!(
        definition.method,
        HttpMethod::Post | HttpMethod::Put | HttpMethod::Patch
    );
    let parameters = build_parameters(&input_schema, &path_input_names, !has_body);
    if !parameters.is_empty() {
        operation_object["parameters"] = Value::Array(parameters);
    }
    if has_body {
        let request_content = match definition.raw_body_input {
            Some(raw_body_input) => {
                json!({ raw_body_input.content_type: { "schema": { "type": "string" } } })
            }
            None if path_input_names.is_empty() => json_content(&input_reference),
            None => json_content(&without_properties(&input_schema, &path_input_names)),
        };
        operation_object["requestBody"] = json!({ "required": true, "content": request_content });
    }
    operation_object
}

fn build_success_response(
    operation: &dyn ErasedOperation,
    schema_components: &mut SchemaComponents,
) -> Value {
    let definition = operation.definition();
    if definition.success_status == SuccessStatus::NoContent {
        return json!({ "description": "Done; no content." });
    }
    match definition.answer_kind {
        AnswerKind::File { content_type } => json!({
            "description": "The file.",
            "content": { content_type: { "schema": { "type": "string", "format": "binary" } } },
        }),
        AnswerKind::Json => json!({
            "description": "OK.",
            "content": json_content(&schema_components.add_root_schema(operation.output_schema())),
        }),
    }
}

/// Path values, and for operations without a body the other inputs, as parameters.
fn build_parameters(
    input_schema: &Value,
    path_input_names: &[String],
    has_query_inputs: bool,
) -> Vec<Value> {
    let required_names: Vec<&str> = input_schema["required"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .collect();
    let mut parameters = Vec::new();
    for (input_name, property_schema) in
        input_schema["properties"].as_object().into_iter().flatten()
    {
        let is_path_input = path_input_names.contains(input_name);
        if !is_path_input && !has_query_inputs {
            continue;
        }
        parameters.push(json!({
            "name": input_name,
            "in": if is_path_input { "path" } else { "query" },
            "required": is_path_input || required_names.contains(&input_name.as_str()),
            "schema": property_schema,
        }));
    }
    parameters
}

fn without_properties(schema: &Value, removed_names: &[String]) -> Value {
    let mut trimmed_schema = schema.clone();
    if let Some(properties) = trimmed_schema["properties"].as_object_mut() {
        properties.retain(|property_name, _| !removed_names.contains(property_name));
    }
    if let Some(required_names) = trimmed_schema["required"].as_array_mut() {
        required_names.retain(|name| {
            !name
                .as_str()
                .is_some_and(|name| removed_names.iter().any(|removed| removed == name))
        });
    }
    trimmed_schema
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
