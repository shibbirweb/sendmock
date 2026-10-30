use std::sync::Arc;

use sendmock_core::{StandardTemplateFunctions, TemplateFunctions};
use serde_json::Value;

use crate::sign_twilio_request;

/// The standard functions plus the provider helpers the built-in templates call. Twilio's
/// signature is real; Mailgun, Svix and Stripe signatures have the provider's shape and are
/// signed for real with the email providers (Phase 4, WH-06.2).
#[derive(Clone)]
pub struct WebhookTemplateFunctions {
    pub standard_functions: StandardTemplateFunctions,
}

const PROVIDER_HELPER_NAMES: [&str; 4] = [
    "twilio_signature",
    "mailgun_signature",
    "svix_signature",
    "stripe_signature",
];

impl WebhookTemplateFunctions {
    fn call_standard_text(&self, function_name: &str, arguments: &[Value]) -> String {
        match self
            .standard_functions
            .call_function(function_name, arguments)
        {
            Some(Value::String(generated_text)) => generated_text,
            Some(other_value) => other_value.to_string(),
            None => String::new(),
        }
    }

    fn sign_twilio(arguments: &[Value]) -> String {
        let text_argument = |index: usize| {
            arguments
                .get(index)
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_owned()
        };
        sign_twilio_request(
            &text_argument(0),
            arguments.get(1).unwrap_or(&Value::Null),
            &text_argument(2),
        )
    }
}

impl TemplateFunctions for WebhookTemplateFunctions {
    fn call_function(&self, function_name: &str, arguments: &[Value]) -> Option<Value> {
        let random_hex = || self.call_standard_text("random_hex", &[Value::from(64)]);
        let helper_text = match function_name {
            "twilio_signature" => Self::sign_twilio(arguments),
            "mailgun_signature" => random_hex(),
            "svix_signature" => format!(
                "v1,{}=",
                self.call_standard_text("random_string", &[Value::from(43)])
            ),
            "stripe_signature" => format!(
                "t={},v1={}",
                self.call_standard_text("now_unix", &[]),
                random_hex()
            ),
            _ => {
                return self
                    .standard_functions
                    .call_function(function_name, arguments);
            }
        };
        Some(Value::from(helper_text))
    }

    fn function_names(&self) -> Vec<&'static str> {
        let mut function_names = self.standard_functions.function_names();
        function_names.extend(PROVIDER_HELPER_NAMES);
        function_names
    }

    fn to_shared(&self) -> Arc<dyn TemplateFunctions> {
        Arc::new(self.clone())
    }
}
