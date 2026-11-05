use serde_json::{Value, json};

/// A Paddle refusal: the HTTP status and the `error` object Paddle answers with.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PaddleError {
    pub status: u16,
    pub code: &'static str,
    pub detail: String,
}

impl PaddleError {
    pub fn new(status: u16, code: &'static str, detail: impl Into<String>) -> Self {
        Self {
            status,
            code,
            detail: detail.into(),
        }
    }

    pub fn authentication_missing() -> Self {
        Self::new(
            401,
            "authentication_missing",
            "Authentication header included, but incorrectly formatted",
        )
    }

    pub fn forbidden() -> Self {
        Self::new(
            403,
            "forbidden",
            "You aren't permitted to perform this request.",
        )
    }

    pub fn not_found(entity_id: &str) -> Self {
        Self::new(404, "not_found", format!("Entity {entity_id} not found"))
    }

    pub fn invalid_field(detail: impl Into<String>) -> Self {
        Self::new(400, "invalid_field", detail)
    }

    pub fn describe(&self, request_id: &str) -> Value {
        json!({
            "error": {
                "type": "request_error",
                "code": self.code,
                "detail": self.detail,
                "documentation_url": format!("https://developer.paddle.com/v1/errors/shared/{}", self.code),
            },
            "meta": { "request_id": request_id },
        })
    }
}

/// What a Paddle API call answers: its status and `data`, or its refusal.
pub type PaddleAnswer = Result<(u16, Value), PaddleError>;
