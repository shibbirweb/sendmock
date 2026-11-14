use serde_json::Value;

use super::stripe_error::StripeError;
use super::stripe_fields::StripeFields;
use crate::OperationContext;

/// One request to Stripe's API with its decoded parameters.
pub struct StripeCall<'call> {
    pub operation_context: &'call OperationContext,
    pub stripe_fields: StripeFields,
}

impl StripeCall<'_> {
    pub fn http_address(&self) -> &str {
        &self.operation_context.instance_details.http_address
    }

    pub fn now_seconds(&self) -> i64 {
        self.operation_context.clock.now_unix_ms() / 1000
    }
}

/// A Stripe object, or Stripe's error.
pub type StripeAnswer = Result<Value, StripeError>;
