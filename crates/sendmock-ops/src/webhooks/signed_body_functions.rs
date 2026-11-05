use std::sync::Arc;

use sendmock_core::TemplateFunctions;
use sendmock_payments::{sign_paddle_payload, sign_razorpay_payload, sign_stripe_payload};
use sendmock_webhooks::{WebhookSecret, sign_payload, sign_sendgrid_event};
use serde_json::Value;

/// The functions header templates see once the body is rendered: the Stripe, Razorpay,
/// Paddle, Svix (Resend) and SendGrid signatures sign that body for real, as each provider's
/// library checks it; every other function is the template's own.
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

/// The argument as text: a string as it is, a number as its digits.
fn read_argument_text(arguments: &[Value], position: usize) -> String {
    match arguments.get(position) {
        Some(Value::String(text)) => text.clone(),
        Some(Value::Null) | None => String::new(),
        Some(other_value) => other_value.to_string(),
    }
}

impl SignedBodyFunctions {
    /// `svix_signature(secret, svix_id, svix_timestamp)`: Standard Webhooks over the body, as
    /// Resend signs through Svix; empty when the secret is not a `whsec_` key.
    fn sign_svix(&self, secret: &str, arguments: &[Value]) -> String {
        let Ok(signing_secret) = WebhookSecret::parse(secret) else {
            return String::new();
        };
        let timestamp_seconds = read_argument_text(arguments, 2).parse().unwrap_or_default();
        sign_payload(
            &signing_secret,
            &read_argument_text(arguments, 1),
            timestamp_seconds,
            &self.signed_body,
        )
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
            "svix_signature" => self.sign_svix(secret, arguments),
            "sendgrid_signature" => {
                sign_sendgrid_event(&read_argument_text(arguments, 0), &self.signed_body)
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
