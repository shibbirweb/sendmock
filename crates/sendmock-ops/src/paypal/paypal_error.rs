use serde_json::{Value, json};

use crate::OperationError;

const ORDERS_DOCS_URL: &str = "https://developer.paypal.com/docs/api/orders/v2/#error-";
const PAYMENTS_DOCS_URL: &str = "https://developer.paypal.com/docs/api/payments/v2/#error-";
const NOTIFICATIONS_DOCS_URL: &str = "https://developer.paypal.com/docs/api/webhooks/v1/#error-";

/// Which PayPal API an error belongs to, for its `information_link`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PayPalApi {
    Orders,
    Payments,
    Notifications,
}

impl PayPalApi {
    fn docs_link(self, issue: &str) -> Value {
        let docs_url = match self {
            Self::Orders => ORDERS_DOCS_URL,
            Self::Payments => PAYMENTS_DOCS_URL,
            Self::Notifications => NOTIFICATIONS_DOCS_URL,
        };
        json!([{"href": format!("{docs_url}{issue}"), "rel": "information_link", "method": "GET"}])
    }
}

/// One of PayPal's error answers: the status and the body, without the `debug_id` the adapter
/// adds to every answer.
#[derive(Debug, Clone, PartialEq)]
pub struct PayPalError {
    pub status: u16,
    pub body: Value,
}

impl PayPalError {
    pub fn authentication_failure() -> Self {
        Self {
            status: 401,
            body: json!({
                "name": "AUTHENTICATION_FAILURE",
                "message": "Authentication failed due to invalid authentication credentials or a missing Authorization header.",
                "links": [{"href": "https://developer.paypal.com/docs/api/overview/#error", "rel": "information_link"}],
            }),
        }
    }

    /// `POST /v1/oauth2/token` without a client id and secret.
    pub fn invalid_client() -> Self {
        Self {
            status: 401,
            body: json!({"error": "invalid_client", "error_description": "Client Authentication failed"}),
        }
    }

    pub fn unsupported_grant_type() -> Self {
        Self {
            status: 400,
            body: json!({"error": "unsupported_grant_type", "error_description": "Grant Type is NULL"}),
        }
    }

    /// A malformed or invalid field: `field` is its JSON pointer, e.g. `/intent`.
    pub fn invalid_request(
        paypal_api: PayPalApi,
        field: &str,
        value: Option<&str>,
        issue: &str,
        description: &str,
    ) -> Self {
        Self {
            status: 400,
            body: json!({
                "name": "INVALID_REQUEST",
                "message": "Request is not well-formed, syntactically incorrect, or violates schema.",
                "details": [{"field": field, "value": value, "location": "body", "issue": issue, "description": description}],
                "links": paypal_api.docs_link(issue),
            }),
        }
    }

    pub fn missing_field(paypal_api: PayPalApi, field: &str) -> Self {
        Self::invalid_request(
            paypal_api,
            field,
            None,
            "MISSING_REQUIRED_PARAMETER",
            "A required field / parameter is missing.",
        )
    }

    pub fn malformed_json(paypal_api: PayPalApi) -> Self {
        Self::invalid_request(
            paypal_api,
            "/",
            None,
            "MALFORMED_REQUEST_JSON",
            "The request JSON is not well formed.",
        )
    }

    /// A request PayPal understood but refuses, such as capturing an order not approved.
    pub fn unprocessable(paypal_api: PayPalApi, issue: &str, description: &str) -> Self {
        Self {
            status: 422,
            body: json!({
                "name": "UNPROCESSABLE_ENTITY",
                "details": [{"issue": issue, "description": description}],
                "message": "The requested action could not be performed, semantically incorrect, or failed business validation.",
                "links": paypal_api.docs_link(issue),
            }),
        }
    }

    /// No order, capture or refund with this id; `field` names it, e.g. `order_id`.
    pub fn resource_missing(paypal_api: PayPalApi, field: &str, resource_id: &str) -> Self {
        Self {
            status: 404,
            body: json!({
                "name": "RESOURCE_NOT_FOUND",
                "details": [{
                    "field": field,
                    "value": resource_id,
                    "location": "path",
                    "issue": "INVALID_RESOURCE_ID",
                    "description": "Specified resource ID does not exist. Please check the resource ID and try again.",
                }],
                "message": "The specified resource does not exist.",
                "links": paypal_api.docs_link("INVALID_RESOURCE_ID"),
            }),
        }
    }

    /// A path PayPal does not serve here.
    pub fn unknown_path() -> Self {
        Self {
            status: 404,
            body: json!({"name": "RESOURCE_NOT_FOUND", "message": "The specified resource does not exist."}),
        }
    }
}

impl From<OperationError> for PayPalError {
    fn from(operation_error: OperationError) -> Self {
        tracing::error!(%operation_error, "PayPal emulation failed");
        Self {
            status: 500,
            body: json!({"name": "INTERNAL_SERVER_ERROR", "message": "An internal server error has occurred."}),
        }
    }
}
