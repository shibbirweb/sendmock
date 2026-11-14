use serde_json::Value;

use super::paypal_error::{PayPalApi, PayPalError};
use crate::OperationContext;

pub const PAYPAL_PROVIDER_KEY: &str = "paypal";

/// Where this instance serves PayPal's API, for the HATEOAS links.
pub fn build_paypal_api_base_url(http_address: &str) -> String {
    format!("http://{http_address}/providers/paypal")
}

/// One request to PayPal's REST API with its JSON body.
pub struct PayPalCall<'call> {
    pub operation_context: &'call OperationContext,
    /// `Null` for an empty body.
    pub request_body: Value,
    pub has_malformed_body: bool,
    /// `Prefer: return=representation` asks for the whole resource.
    pub prefers_representation: bool,
}

impl PayPalCall<'_> {
    pub fn http_address(&self) -> &str {
        &self.operation_context.instance_details.http_address
    }

    pub fn api_base_url(&self) -> String {
        build_paypal_api_base_url(self.http_address())
    }

    /// The body as an object, refusing a body that is not JSON.
    pub fn read_body(&self, paypal_api: PayPalApi) -> Result<&Value, PayPalError> {
        if self.has_malformed_body {
            return Err(PayPalError::malformed_json(paypal_api));
        }
        Ok(&self.request_body)
    }

    /// A new id as PayPal writes them: 17 capitals and digits.
    pub fn generate_paypal_id(&self) -> String {
        let generated_id = self
            .operation_context
            .id_generator
            .generate_id()
            .to_string();
        generated_id
            .chars()
            .skip(generated_id.chars().count().saturating_sub(17))
            .collect::<String>()
            .to_ascii_uppercase()
    }
}

/// A PayPal answer: the status (`200`, `201`) and the resource.
#[derive(Debug, Clone, PartialEq)]
pub struct PayPalReply {
    pub status: u16,
    pub body: Value,
}

pub type PayPalAnswer = Result<PayPalReply, PayPalError>;
