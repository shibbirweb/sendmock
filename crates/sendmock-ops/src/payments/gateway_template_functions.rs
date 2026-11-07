use std::sync::Arc;

use sendmock_core::{StandardTemplateFunctions, TemplateFunctions};
use sendmock_payments::{sign_paddle_payload, sign_razorpay_payload, sign_stripe_payload};
use serde_json::Value;

use crate::webhooks::sign_sslcommerz_arguments;

/// The signing functions a gateway's notification headers call.
const SIGNING_FUNCTION_NAMES: [&str; 4] = [
    "stripe_signature",
    "razorpay_signature",
    "paddle_signature",
    "sslcommerz_verify_sign",
];

/// The standard functions plus the provider signatures (`stripe_signature`,
/// `razorpay_signature` and `paddle_signature` sign the notification body already rendered,
/// empty for redirect fields, at the event's time) and `sslcommerz_verify_sign`.
#[derive(Clone)]
pub struct GatewayTemplateFunctions {
    pub standard_functions: StandardTemplateFunctions,
    pub timestamp_seconds: i64,
    pub signed_body: String,
}

impl TemplateFunctions for GatewayTemplateFunctions {
    fn call_function(&self, function_name: &str, arguments: &[Value]) -> Option<Value> {
        let signing_secret = arguments
            .first()
            .and_then(Value::as_str)
            .unwrap_or_default();
        match function_name {
            "stripe_signature" => Some(Value::from(sign_stripe_payload(
                signing_secret,
                self.timestamp_seconds,
                &self.signed_body,
            ))),
            "razorpay_signature" => Some(Value::from(sign_razorpay_payload(
                signing_secret,
                &self.signed_body,
            ))),
            "paddle_signature" => Some(Value::from(sign_paddle_payload(
                signing_secret,
                self.timestamp_seconds,
                &self.signed_body,
            ))),
            "sslcommerz_verify_sign" => Some(Value::from(sign_sslcommerz_arguments(arguments))),
            _ => self
                .standard_functions
                .call_function(function_name, arguments),
        }
    }

    fn function_names(&self) -> Vec<&'static str> {
        let mut function_names = self.standard_functions.function_names();
        function_names.extend(SIGNING_FUNCTION_NAMES);
        function_names
    }

    fn to_shared(&self) -> Arc<dyn TemplateFunctions> {
        Arc::new(self.clone())
    }
}
