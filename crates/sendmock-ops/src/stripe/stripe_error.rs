use serde_json::{Map, Value, json};

use crate::OperationError;

/// An error in Stripe's shape: `{"error": {"type", "code", "decline_code", "message",
/// "param", "doc_url", ...}}` with Stripe's HTTP status.
#[derive(Debug, Clone, PartialEq)]
pub struct StripeError {
    pub status: u16,
    pub error_type: &'static str,
    pub code: Option<&'static str>,
    pub message: String,
    pub param: Option<String>,
    /// More fields Stripe adds, such as a card error's `decline_code` and `payment_intent`.
    pub extra_fields: Map<String, Value>,
}

impl StripeError {
    pub fn invalid_request(
        status: u16,
        code: Option<&'static str>,
        message: impl Into<String>,
    ) -> Self {
        Self {
            status,
            error_type: "invalid_request_error",
            code,
            message: message.into(),
            param: None,
            extra_fields: Map::new(),
        }
    }

    pub fn with_param(mut self, param: impl Into<String>) -> Self {
        self.param = Some(param.into());
        self
    }

    pub fn missing_param(param: &str) -> Self {
        Self::invalid_request(
            400,
            Some("parameter_missing"),
            format!("Missing required param: {param}."),
        )
        .with_param(param)
    }

    pub fn invalid_integer(param: &str, sent_value: &str) -> Self {
        Self::invalid_request(
            400,
            Some("parameter_invalid_integer"),
            format!("Invalid integer: {sent_value}"),
        )
        .with_param(param)
    }

    pub fn invalid_value(param: &str, message: impl Into<String>) -> Self {
        Self::invalid_request(400, None, message).with_param(param)
    }

    /// `No such payment_intent: 'pi_123'`.
    pub fn resource_missing(object_name: &str, object_id: &str, param: &str) -> Self {
        Self::invalid_request(
            404,
            Some("resource_missing"),
            format!("No such {object_name}: '{object_id}'"),
        )
        .with_param(param)
    }

    pub fn unexpected_state(message: impl Into<String>) -> Self {
        Self::invalid_request(400, Some("payment_intent_unexpected_state"), message)
    }

    pub fn unrecognized_url(method: &str, path: &str) -> Self {
        Self::invalid_request(
            404,
            None,
            format!(
                "Unrecognized request URL ({method}: {path}). Please see https://stripe.com/docs or we can help at https://support.stripe.com/."
            ),
        )
    }

    pub fn missing_api_key() -> Self {
        Self::invalid_request(
            401,
            None,
            "You did not provide an API key. You need to provide your API key in the Authorization header, using Bearer auth (e.g. 'Authorization: Bearer YOUR_SECRET_KEY'). See https://stripe.com/docs/api#authentication for details, or we can help at https://support.stripe.com/.",
        )
    }

    pub fn invalid_api_key(masked_api_key: &str) -> Self {
        Self::invalid_request(
            401,
            None,
            format!("Invalid API Key provided: {masked_api_key}"),
        )
    }

    /// The body Stripe answers with; `doc_url` follows from the code.
    pub fn to_body(&self) -> Value {
        let mut error_fields = self.extra_fields.clone();
        error_fields.insert("type".to_owned(), json!(self.error_type));
        error_fields.insert("message".to_owned(), json!(self.message));
        if let Some(code) = self.code {
            error_fields.insert("code".to_owned(), json!(code));
            error_fields.insert(
                "doc_url".to_owned(),
                json!(format!(
                    "https://stripe.com/docs/error-codes/{}",
                    code.replace('_', "-")
                )),
            );
        }
        if let Some(param) = &self.param {
            error_fields.insert("param".to_owned(), json!(param));
        }
        json!({ "error": error_fields })
    }
}

/// SendMock's own failures are Stripe's `api_error`, as an outage at Stripe would be.
impl From<OperationError> for StripeError {
    fn from(operation_error: OperationError) -> Self {
        Self {
            status: 500,
            error_type: "api_error",
            code: None,
            message: operation_error.to_string(),
            param: None,
            extra_fields: Map::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn answers_in_stripe_error_shape_with_the_doc_url_of_its_code() {
        let missing_error = StripeError::resource_missing("payment_intent", "pi_404", "intent");

        assert_eq!(missing_error.status, 404);
        assert_eq!(
            missing_error.to_body(),
            json!({
                "error": {
                    "type": "invalid_request_error",
                    "code": "resource_missing",
                    "doc_url": "https://stripe.com/docs/error-codes/resource-missing",
                    "message": "No such payment_intent: 'pi_404'",
                    "param": "intent",
                }
            })
        );
    }
}
