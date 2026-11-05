use std::sync::Arc;

use sendmock_core::TemplateFunctions;
use sendmock_payments::{sign_paddle_payload, sign_razorpay_payload, sign_stripe_payload};
use serde_json::Value;

/// The functions header templates see once the body is rendered: the Stripe, Razorpay and
/// Paddle signatures sign that body for real, as each provider's library checks it; every
/// other function is the template's own.
#[derive(Clone)]
pub struct SignedBodyFunctions {
    pub template_functions: Arc<dyn TemplateFunctions>,
    pub signed_body: String,
}

impl SignedBodyFunctions {
    fn read_now_seconds(&self) -> i64 {
        self.template_functions
            .call_function("now_unix", &[])
            .and_then(|now_unix| match now_unix {
                Value::Number(seconds) => seconds.as_i64(),
                Value::String(seconds_text) => seconds_text.parse().ok(),
                _ => None,
            })
            .unwrap_or_default()
    }
}

impl TemplateFunctions for SignedBodyFunctions {
    fn call_function(&self, function_name: &str, arguments: &[Value]) -> Option<Value> {
        let secret = arguments
            .first()
            .and_then(Value::as_str)
            .unwrap_or_default();
        let signature = match function_name {
            "stripe_signature" => {
                sign_stripe_payload(secret, self.read_now_seconds(), &self.signed_body)
            }
            "razorpay_signature" => sign_razorpay_payload(secret, &self.signed_body),
            "paddle_signature" => {
                sign_paddle_payload(secret, self.read_now_seconds(), &self.signed_body)
            }
            _ => {
                return self
                    .template_functions
                    .call_function(function_name, arguments);
            }
        };
        Some(Value::from(signature))
    }

    fn function_names(&self) -> Vec<&'static str> {
        self.template_functions.function_names()
    }

    fn to_shared(&self) -> Arc<dyn TemplateFunctions> {
        Arc::new(self.clone())
    }
}
