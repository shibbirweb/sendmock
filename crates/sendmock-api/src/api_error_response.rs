use axum::Json;
use axum::http::{Method, StatusCode};
use axum::response::{IntoResponse, Response};
use sendmock_ops::OperationError;
use serde::Serialize;

/// The contract's error body: `{ "error": { "code", "message", "field"? } }`.
#[derive(Debug, Serialize)]
struct ApiErrorBody {
    error: ApiErrorDetail,
}

#[derive(Debug, Serialize)]
struct ApiErrorDetail {
    code: &'static str,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    field: Option<String>,
}

#[derive(Debug)]
pub struct ApiErrorResponse {
    status: StatusCode,
    detail: ApiErrorDetail,
}

impl ApiErrorResponse {
    pub fn unknown_route(method: &Method, path: &str) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            detail: ApiErrorDetail {
                code: "not_found",
                message: format!("No API operation at {method} {path}"),
                field: None,
            },
        }
    }

    pub fn invalid_json_body(reason: &str) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            detail: ApiErrorDetail {
                code: "invalid_input",
                message: format!("The request body is not valid JSON: {reason}"),
                field: None,
            },
        }
    }
}

impl From<OperationError> for ApiErrorResponse {
    fn from(operation_error: OperationError) -> Self {
        let status = match &operation_error {
            OperationError::InvalidInput { .. } => StatusCode::BAD_REQUEST,
            OperationError::NotFound { .. } => StatusCode::NOT_FOUND,
            OperationError::Timeout { .. } => StatusCode::REQUEST_TIMEOUT,
            OperationError::Store(_) | OperationError::Internal(_) => {
                tracing::error!(error = %operation_error, "operation failed");
                StatusCode::INTERNAL_SERVER_ERROR
            }
        };
        Self {
            status,
            detail: ApiErrorDetail {
                code: operation_error.code(),
                field: operation_error.field().map(str::to_owned),
                message: operation_error.to_string(),
            },
        }
    }
}

impl IntoResponse for ApiErrorResponse {
    fn into_response(self) -> Response {
        (self.status, Json(ApiErrorBody { error: self.detail })).into_response()
    }
}
