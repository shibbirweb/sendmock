use std::collections::HashMap;
use std::sync::Arc;

use axum::Json;
use axum::Router;
use axum::body::Bytes;
use axum::extract::{Query, RawPathParams};
use axum::http::StatusCode;
use axum::http::header::{CONTENT_DISPOSITION, CONTENT_TYPE};
use axum::response::{IntoResponse, Response};
use axum::routing::{MethodFilter, MethodRouter, on};
use sendmock_ops::{
    ErasedOperation, HttpMethod, OperationAnswer, OperationContext, OperationRegistry,
    build_input_from_text, to_snake_case,
};
use serde_json::{Map, Value};

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

/// The pieces of a request an operation's input is built from.
struct RequestParts {
    path_parameters: Vec<(String, String)>,
    query_parameters: Vec<(String, String)>,
    body: Bytes,
}

fn build_operation_route(
    operation: Arc<dyn ErasedOperation>,
    operation_context: OperationContext,
) -> MethodRouter {
    let method_filter = to_method_filter(operation.definition().method);
    let input_schema = Arc::new(operation.input_schema().to_value());
    on(
        method_filter,
        move |path_parameters: RawPathParams,
              Query(query_parameters): Query<Vec<(String, String)>>,
              body: Bytes| async move {
            let request_parts = RequestParts {
                path_parameters: path_parameters
                    .iter()
                    .map(|(name, value)| (to_snake_case(name), value.to_owned()))
                    .collect(),
                query_parameters,
                body,
            };
            match assemble_input(operation.as_ref(), &input_schema, request_parts) {
                Ok(input) => run_operation(operation.as_ref(), &operation_context, input).await,
                Err(error_response) => error_response.into_response(),
            }
        },
    )
}

/// The JSON body (or the raw body in its input field), with the query and path values
/// converted to the input's types on top; path values win, since they name the item.
fn assemble_input(
    operation: &dyn ErasedOperation,
    input_schema: &Value,
    request_parts: RequestParts,
) -> Result<Value, ApiErrorResponse> {
    let definition = operation.definition();
    let mut input = match definition.raw_body_input {
        Some(raw_body_input) => {
            let mut raw_input = Map::new();
            let body_text = String::from_utf8_lossy(&request_parts.body).into_owned();
            raw_input.insert(
                raw_body_input.input_name.to_owned(),
                Value::String(body_text),
            );
            raw_input
        }
        None if has_json_body(definition.method) => parse_json_body(&request_parts.body)?,
        None => Map::new(),
    };
    let text_values: Vec<(String, String)> = request_parts
        .query_parameters
        .into_iter()
        .chain(request_parts.path_parameters)
        .collect();
    input
        .extend(build_input_from_text(input_schema, &text_values).map_err(ApiErrorResponse::from)?);
    Ok(Value::Object(input))
}

fn has_json_body(method: HttpMethod) -> bool {
    matches!(
        method,
        HttpMethod::Post | HttpMethod::Put | HttpMethod::Patch
    )
}

/// An empty body counts as `{}`, so operations with only optional fields need no body.
fn parse_json_body(request_body: &[u8]) -> Result<Map<String, Value>, ApiErrorResponse> {
    if request_body.is_empty() {
        return Ok(Map::new());
    }
    match serde_json::from_slice(request_body) {
        Ok(Value::Object(body_fields)) => Ok(body_fields),
        Ok(_) => Err(ApiErrorResponse::invalid_json_body(
            "expected a JSON object",
        )),
        Err(parse_error) => Err(ApiErrorResponse::invalid_json_body(
            &parse_error.to_string(),
        )),
    }
}

async fn run_operation(
    operation: &dyn ErasedOperation,
    operation_context: &OperationContext,
    input: Value,
) -> Response {
    let success_status = StatusCode::from_u16(operation.definition().success_status.code())
        .unwrap_or(StatusCode::OK);
    match operation.execute_answer(operation_context, input).await {
        Ok(OperationAnswer::Json(answer)) => (success_status, Json(answer)).into_response(),
        Ok(OperationAnswer::File(file_answer)) => {
            let content_disposition = match &file_answer.file_name {
                Some(file_name) => {
                    format!("attachment; filename=\"{}\"", file_name.replace('"', ""))
                }
                None => "inline".to_owned(),
            };
            (
                StatusCode::OK,
                [
                    (CONTENT_TYPE, file_answer.content_type),
                    (CONTENT_DISPOSITION, content_disposition),
                ],
                file_answer.bytes,
            )
                .into_response()
        }
        Ok(OperationAnswer::Empty) => StatusCode::NO_CONTENT.into_response(),
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

    #[tokio::test]
    async fn fills_path_and_query_values_with_their_types() {
        let response = build_test_router()
            .oneshot(build_request(
                "GET",
                "/api/v1/test/items/01J0ITEM?count=3&is_urgent=true",
                "",
            ))
            .await
            .expect("a response");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(
            read_json_body(response).await,
            json!({ "item_id": "01J0ITEM", "count": 3, "is_urgent": true })
        );
    }

    #[tokio::test]
    async fn a_query_value_of_the_wrong_type_is_a_bad_request_naming_it() {
        let response = build_test_router()
            .oneshot(build_request(
                "GET",
                "/api/v1/test/items/01J0ITEM?count=many",
                "",
            ))
            .await
            .expect("a response");

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert_eq!(read_json_body(response).await["error"]["field"], "count");
    }

    #[tokio::test]
    async fn answers_created_files_and_no_content_with_their_status() {
        let created = build_test_router()
            .oneshot(build_request(
                "POST",
                "/api/v1/test/raw",
                "From: a@b.test\r\n\r\nHi",
            ))
            .await
            .expect("a response");
        let file = build_test_router()
            .oneshot(build_request("GET", "/api/v1/test/file", ""))
            .await
            .expect("a response");
        let deleted = build_test_router()
            .oneshot(build_request("DELETE", "/api/v1/test/items/01J0ITEM", ""))
            .await
            .expect("a response");

        assert_eq!(created.status(), StatusCode::CREATED);
        assert_eq!(
            read_json_body(created).await,
            json!({ "text": "From: a@b.test\r\n\r\nHi" })
        );
        assert_eq!(file.headers()[CONTENT_TYPE], "message/rfc822");
        assert_eq!(
            file.headers()[CONTENT_DISPOSITION],
            "attachment; filename=\"message.eml\""
        );
        assert_eq!(deleted.status(), StatusCode::NO_CONTENT);
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
