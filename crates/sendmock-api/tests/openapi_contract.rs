use std::collections::BTreeSet;
use std::sync::Arc;

use axum::body::Body;
use axum::http::Request;
use sendmock_api::{UiAsset, UiAssets, build_app_router, build_openapi_document};
use sendmock_core::FixedClock;
use sendmock_ops::{
    InstanceDetails, OperationContext, OperationRegistry, ReleaseChannel, build_operation_registry,
};
use sendmock_store::{Database, DatabaseLocation, EMBEDDED_MIGRATIONS};
use serde_json::{Value, json};
use tower::ServiceExt;

const FROZEN_CONTRACT_PATH: &str =
    concat!(env!("CARGO_MANIFEST_DIR"), "/../../docs/api/openapi.yaml");

struct NoUiAssets;

impl UiAssets for NoUiAssets {
    fn find_asset(&self, _asset_path: &str) -> Option<UiAsset> {
        None
    }
}

/// One request body per operation, sent through the router; an operation without a sample
/// fails the answer test, so every new operation brings one.
fn sample_inputs(operation_id: &str) -> Option<Vec<Value>> {
    match operation_id {
        "getHealth" | "getInfo" => Some(vec![json!({})]),
        "postSeedValidate" => Some(vec![
            json!({ "seed_toml": "[[numbers]]\nnumber = \"+15550001111\"\n" }),
            json!({ "seed_toml": "[[mystery]]\nkey = 1\n" }),
        ]),
        _ => None,
    }
}

fn read_frozen_contract() -> Value {
    let contract_yaml = std::fs::read_to_string(FROZEN_CONTRACT_PATH)
        .unwrap_or_else(|error| panic!("the frozen contract exists: {error}"));
    serde_yaml_ng::from_str(&contract_yaml)
        .unwrap_or_else(|error| panic!("the frozen contract is valid YAML: {error}"))
}

fn build_operation_context() -> OperationContext {
    OperationContext {
        database: Arc::new(
            Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)
                .unwrap_or_else(|error| panic!("an in-memory database: {error}")),
        ),
        clock: Arc::new(FixedClock::new(1_767_225_600_000)),
        instance_details: Arc::new(InstanceDetails {
            version: "0.0.0",
            channel: ReleaseChannel::Dev,
            started_at_unix_ms: 1_767_225_600_000,
            http_address: "127.0.0.1:8025".to_owned(),
            smtp_address: "127.0.0.1:1025".to_owned(),
            provider_address: None,
            is_container: false,
        }),
    }
}

/// Follows `$ref`s into `components.schemas` until it reaches a schema with a body.
fn resolve_schema<'document>(
    document: &'document Value,
    schema: &'document Value,
) -> &'document Value {
    match schema["$ref"]
        .as_str()
        .and_then(|reference| reference.strip_prefix("#/"))
    {
        Some(pointer) => resolve_schema(
            document,
            document
                .pointer(&format!("/{pointer}"))
                .unwrap_or(&Value::Null),
        ),
        None => schema,
    }
}

fn top_level_shape(document: &Value, schema: &Value) -> (BTreeSet<String>, BTreeSet<String>) {
    let resolved_schema = resolve_schema(document, schema);
    let property_names = resolved_schema["properties"]
        .as_object()
        .into_iter()
        .flat_map(|properties| properties.keys().cloned())
        .collect();
    let required_names = resolved_schema["required"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|name| name.as_str().map(str::to_owned))
        .collect();
    (property_names, required_names)
}

fn response_schema(operation_object: &Value) -> &Value {
    &operation_object["responses"]["200"]["content"]["application/json"]["schema"]
}

fn request_schema(operation_object: &Value) -> &Value {
    &operation_object["requestBody"]["content"]["application/json"]["schema"]
}

fn served_operations(operation_registry: &OperationRegistry) -> Vec<(String, String, String)> {
    operation_registry
        .operations()
        .iter()
        .map(|operation| {
            let definition = operation.definition();
            (
                definition.path.to_owned(),
                definition.method.as_str().to_lowercase(),
                definition.operation_id.to_owned(),
            )
        })
        .collect()
}

// AC: PL-01.1
#[test]
fn every_served_operation_is_in_the_frozen_contract_with_the_same_id_and_summary() {
    let frozen_contract = read_frozen_contract();
    let generated_document = build_openapi_document(&build_operation_registry(), "0.0.0");

    for (path, method, operation_id) in served_operations(&build_operation_registry()) {
        let frozen_operation = &frozen_contract["paths"][&path][&method];
        let generated_operation = &generated_document["paths"][&path][&method];

        assert!(
            frozen_operation.is_object(),
            "{method} {path} is not in docs/api/openapi.yaml"
        );
        assert_eq!(
            frozen_operation["operationId"], operation_id,
            "{method} {path}"
        );
        assert_eq!(
            frozen_operation["summary"], generated_operation["summary"],
            "{method} {path}"
        );
    }
}

// AC: PL-01.1
#[test]
fn bodies_have_the_contract_properties_and_required_fields() {
    let frozen_contract = read_frozen_contract();
    let generated_document = build_openapi_document(&build_operation_registry(), "0.0.0");

    for (path, method, _) in served_operations(&build_operation_registry()) {
        let frozen_operation = &frozen_contract["paths"][&path][&method];
        let generated_operation = &generated_document["paths"][&path][&method];

        assert_eq!(
            top_level_shape(&generated_document, response_schema(generated_operation)),
            top_level_shape(&frozen_contract, response_schema(frozen_operation)),
            "the answer of {method} {path}"
        );
        assert_eq!(
            top_level_shape(&generated_document, request_schema(generated_operation)),
            top_level_shape(&frozen_contract, request_schema(frozen_operation)),
            "the request body of {method} {path}"
        );
    }
}

fn validate_against_frozen_schema(
    frozen_contract: &Value,
    schema: &Value,
    instance: &Value,
) -> Vec<String> {
    let mut validation_root = schema.clone();
    validation_root["components"] = frozen_contract["components"].clone();
    let validator = jsonschema::draft202012::new(&validation_root)
        .unwrap_or_else(|error| panic!("the frozen schema compiles: {error}"));
    validator
        .iter_errors(instance)
        .map(|error| error.to_string())
        .collect()
}

async fn send_operation_request(
    app_router: &axum::Router,
    method: &str,
    path: &str,
    input: &Value,
) -> Value {
    let has_request_body = method != "get" && method != "delete";
    let request = Request::builder()
        .method(method.to_uppercase().as_str())
        .uri(path)
        .header("content-type", "application/json")
        .body(if has_request_body {
            Body::from(input.to_string())
        } else {
            Body::empty()
        })
        .unwrap_or_else(|error| panic!("a valid request: {error}"));
    let response = app_router
        .clone()
        .oneshot(request)
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));
    assert!(
        response.status().is_success(),
        "{method} {path} answered {}",
        response.status()
    );
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    serde_json::from_slice(&body_bytes).unwrap_or_else(|error| panic!("a JSON answer: {error}"))
}

// AC: PL-01.1
#[tokio::test]
async fn real_answers_and_sample_requests_match_the_frozen_schemas() {
    let frozen_contract = read_frozen_contract();
    let operation_registry = build_operation_registry();
    let app_router = build_app_router(
        &operation_registry,
        &build_operation_context(),
        Arc::new(NoUiAssets),
    );

    for (path, method, operation_id) in served_operations(&operation_registry) {
        let frozen_operation = &frozen_contract["paths"][&path][&method];
        let inputs = sample_inputs(&operation_id)
            .unwrap_or_else(|| panic!("add sample inputs for {operation_id}"));
        for input in inputs {
            if method != "get" && method != "delete" {
                let request_errors = validate_against_frozen_schema(
                    &frozen_contract,
                    request_schema(frozen_operation),
                    &input,
                );
                assert!(
                    request_errors.is_empty(),
                    "the sample request of {operation_id}: {request_errors:?}"
                );
            }

            let answer = send_operation_request(&app_router, &method, &path, &input).await;

            let answer_errors = validate_against_frozen_schema(
                &frozen_contract,
                response_schema(frozen_operation),
                &answer,
            );
            assert!(
                answer_errors.is_empty(),
                "the answer of {operation_id}: {answer_errors:?}"
            );
        }
    }
}

fn collect_references(value: &Value, references: &mut Vec<String>) {
    match value {
        Value::Object(object) => {
            if let Some(Value::String(reference)) = object.get("$ref") {
                references.push(reference.clone());
            }
            object
                .values()
                .for_each(|nested_value| collect_references(nested_value, references));
        }
        Value::Array(items) => items
            .iter()
            .for_each(|item| collect_references(item, references)),
        _ => {}
    }
}

// AC: PL-01.3
#[tokio::test]
async fn serves_a_valid_openapi_document() {
    let app_router = build_app_router(
        &build_operation_registry(),
        &build_operation_context(),
        Arc::new(NoUiAssets),
    );

    let response = app_router
        .oneshot(
            Request::builder()
                .uri("/api/openapi.json")
                .body(Body::empty())
                .unwrap_or_else(|error| panic!("a valid request: {error}")),
        )
        .await
        .unwrap_or_else(|error| panic!("a response: {error}"));

    assert!(response.status().is_success());
    let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap_or_else(|error| panic!("a body: {error}"));
    let openapi_document: Value = serde_json::from_slice(&body_bytes)
        .unwrap_or_else(|error| panic!("a JSON document: {error}"));
    assert_eq!(openapi_document["openapi"], "3.1.0");
    let mut references = Vec::new();
    collect_references(&openapi_document, &mut references);
    for reference in references {
        let pointer = reference.strip_prefix('#').unwrap_or_default();
        assert!(
            openapi_document.pointer(pointer).is_some(),
            "{reference} does not resolve"
        );
    }
    for (schema_name, schema) in openapi_document["components"]["schemas"]
        .as_object()
        .into_iter()
        .flatten()
    {
        assert!(
            jsonschema::meta::is_valid(schema),
            "{schema_name} is not a valid JSON Schema"
        );
    }
}
