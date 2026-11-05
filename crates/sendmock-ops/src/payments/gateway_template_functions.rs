use std::sync::Arc;

use sendmock_core::{StandardTemplateFunctions, TemplateFunctions};
use sendmock_payments::sign_stripe_payload;
use serde_json::Value;

use crate::webhooks::sign_sslcommerz_arguments;

/// The standard functions plus `stripe_signature`, which signs the notification body already
/// rendered (empty for redirect fields) at the event's time, and `sslcommerz_verify_sign`.
#[derive(Clone)]
pub struct GatewayTemplateFunctions {
    pub standard_functions: StandardTemplateFunctions,
    pub timestamp_seconds: i64,
    pub signed_body: String,
}

impl TemplateFunctions for GatewayTemplateFunctions {
    fn call_function(&self, function_name: &str, arguments: &[Value]) -> Option<Value> {
        match function_name {
            "stripe_signature" => {
                let webhook_secret = arguments
                    .first()
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                Some(Value::from(sign_stripe_payload(
                    webhook_secret,
                    self.timestamp_seconds,
                    &self.signed_body,
                )))
            }
            "sslcommerz_verify_sign" => Some(Value::from(sign_sslcommerz_arguments(arguments))),
            _ => self
                .standard_functions
                .call_function(function_name, arguments),
        }
    }

    fn function_names(&self) -> Vec<&'static str> {
        let mut function_names = self.standard_functions.function_names();
        function_names.push("stripe_signature");
        function_names.push("sslcommerz_verify_sign");
        function_names
    }

    fn to_shared(&self) -> Arc<dyn TemplateFunctions> {
        Arc::new(self.clone())
    }
}
