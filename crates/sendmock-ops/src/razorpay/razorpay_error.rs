use serde_json::{Value, json};

/// A Razorpay refusal: the HTTP status and the `error` object Razorpay answers with.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RazorpayError {
    pub status: u16,
    pub description: String,
    pub field: Option<&'static str>,
}

impl RazorpayError {
    pub fn bad_request(description: impl Into<String>) -> Self {
        Self {
            status: 400,
            description: description.into(),
            field: None,
        }
    }

    pub fn invalid_field(field: &'static str, description: impl Into<String>) -> Self {
        Self {
            status: 400,
            description: description.into(),
            field: Some(field),
        }
    }

    pub fn authentication_failed() -> Self {
        Self {
            status: 401,
            description: "Authentication failed".to_owned(),
            field: None,
        }
    }

    pub fn missing_id() -> Self {
        Self::bad_request("The id provided does not exist")
    }

    pub fn unknown_url() -> Self {
        Self::bad_request("The requested URL was not found on the server.")
    }

    /// The body: authentication failures name no source, step or reason, as Razorpay's do.
    pub fn describe(&self) -> Value {
        let is_authentication = self.status == 401;
        let read_detail = |detail: &'static str| if is_authentication { "NA" } else { detail };
        let mut error = json!({
            "code": "BAD_REQUEST_ERROR",
            "description": self.description,
            "source": read_detail("business"),
            "step": read_detail("payment_initiation"),
            "reason": read_detail("input_validation_failed"),
            "metadata": {},
        });
        if let Some(field) = self.field {
            error["field"] = Value::from(field);
        }
        json!({ "error": error })
    }
}

/// What a Razorpay API call answers: its status and body, or its refusal.
pub type RazorpayAnswer = Result<(u16, Value), RazorpayError>;
