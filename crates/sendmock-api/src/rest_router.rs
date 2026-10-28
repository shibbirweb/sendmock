use std::collections::HashMap;
use std::sync::Arc;

use axum::Json;
use axum::Router;
use axum::body::Bytes;
use axum::extract::Query;
use axum::response::{IntoResponse, Response};
use axum::routing::{MethodFilter, MethodRouter, on};
use sendmock_ops::{ErasedOperation, HttpMethod, OperationContext, OperationRegistry};
use serde_json::Value;

use crate::api_error_response::ApiErrorResponse;

/// One route per registered operation, at the path and method the contract gives it.
pub fn build_rest_router(
    operation_registry: &OperationRegistry,
    operation_context: &OperationContext,
) -> Router {
    let mut method_routers: HashMap<&'static str, MethodRouter> = HashMap::new();
    for operation in operation_registry.operations() {
        let definition = operation.definition();
        let operation_route =
            build_operation_route(Arc::clone(operation), operation_context.clone());
        let method_router = match method_routers.remove(definition.path) {
            Some(existing_router) => existing_router.merge(operation_route),
            None => operation_route,
        };
        method_routers.insert(definition.path, method_router);
    }
    method_routers
        .into_iter()
        .fold(Router::new(), |router, (path, method_router)| {
            router.route(path, method_router)
        })
}

fn build_operation_route(
    operation: Arc<dyn ErasedOperation>,
    operation_context: OperationContext,
) -> MethodRouter {
    let method = operation.definition().method;
    let method_filter = to_method_filter(method);
    match method {
        HttpMethod::Get | HttpMethod::Delete => on(
            method_filter,
            move |Query(query_parameters): Query<HashMap<String, String>>| async move {
                let input = Value::Object(
                    query_parameters
                        .into_iter()
                        .map(|(name, value)| (name, Value::String(value)))
                        .collect(),
                );
                run_operation(operation.as_ref(), &operation_context, input).await
            },
        ),
        HttpMethod::Post | HttpMethod::Put | HttpMethod::Patch => {
            on(method_filter, move |request_body: Bytes| async move {
                match parse_json_body(&request_body) {
                    Ok(input) => run_operation(operation.as_ref(), &operation_context, input).await,
                    Err(error_response) => error_response.into_response(),
                }
            })
        }
    }
}

/// An empty body counts as `{}`, so operations with only optional fields need no body.
fn parse_json_body(request_body: &[u8]) -> Result<Value, ApiErrorResponse> {
    if request_body.is_empty() {
        return Ok(Value::Object(serde_json::Map::new()));
    }
    serde_json::from_slice(request_body)
        .map_err(|parse_error| ApiErrorResponse::invalid_json_body(&parse_error.to_string()))
}

async fn run_operation(
    operation: &dyn ErasedOperation,
    operation_context: &OperationContext,
    input: Value,
) -> Response {
    match operation.execute_json(operation_context, input).await {
        Ok(output) => Json(output).into_response(),
        Err(operation_error) => ApiErrorResponse::from(operation_error).into_response(),
    }
}

fn to_method_filter(method: HttpMethod) -> MethodFilter {
    match method {
        HttpMethod::Get => MethodFilter::GET,
        HttpMethod::Post => MethodFilter::POST,
        HttpMethod::Put => MethodFilter::PUT,
        HttpMethod::Patch => MethodFilter::PATCH,
        HttpMethod::Delete => MethodFilter::DELETE,
    }
}

#[cfg(test)]
mod tests {
    use axum::http::StatusCode;
    use serde_json::json;
    use tower::ServiceExt;

    use super::*;
    use crate::test_support::{
        build_request, build_test_operation_context, build_test_operation_registry, read_json_body,
    };

    fn build_test_router() -> Router {
        build_rest_router(
            &build_test_operation_registry(),
            &build_test_operation_context(),
        )
    }

    #[tokio::test]
    async fn answers_the_health_check() {
        let response = build_test_router()
            .oneshot(build_request("GET", "/api/v1/health", ""))
            .await
            .expect("a response");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(read_json_body(response).await, json!({ "status": "ok" }));
    }

    #[tokio::test]
    async fn answers_info_with_the_database_in_use() {
        let response = build_test_router()
            .oneshot(build_request("GET", "/api/v1/info", ""))
            .await
            .expect("a response");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(read_json_body(response).await["database_path"], "memory");
    }

    #[tokio::test]
    async fn passes_a_json_body_to_the_operation() {
        let response = build_test_router()
            .oneshot(build_request(
                "POST",
                "/api/v1/test/echo",
                r#"{"text":"hello"}"#,
            ))
            .await
            .expect("a response");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(read_json_body(response).await, json!({ "text": "hello" }));
    }

    // AC: PL-01.2
    #[tokio::test]
    async fn malformed_json_is_a_bad_request_in_the_contract_error_shape() {
        let response = build_test_router()
            .oneshot(build_request("POST", "/api/v1/test/echo", "{not json"))
            .await
            .expect("a response");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let error_body = read_json_body(response).await;
        assert_eq!(error_body["error"]["code"], "invalid_input");
        assert!(error_body["error"]["message"].is_string());
    }

    #[tokio::test]
    async fn a_body_missing_a_required_field_is_a_bad_request() {
        let response = build_test_router()
            .oneshot(build_request("POST", "/api/v1/test/echo", "{}"))
            .await
            .expect("a response");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert!(
            read_json_body(response).await["error"]["message"]
                .as_str()
                .is_some_and(|message| message.contains("text"))
        );
    }
}
