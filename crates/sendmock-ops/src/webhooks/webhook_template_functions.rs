use std::collections::BTreeMap;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use std::sync::Arc;

use sendmock_core::{StandardTemplateFunctions, TemplateFunctions};
use sendmock_payments::sign_sslcommerz_fields;
use sendmock_webhooks::sign_mailgun_token;
use serde_json::Value;

use crate::sign_twilio_request;

/// `sslcommerz_verify_sign(store_password, {"amount": ..., ...})`: the fields as SSLCommerz
/// signs them, values written as text; only those its `verify_key` names when it has one, as
/// an app's check reads them.
pub(crate) fn sign_sslcommerz_arguments(arguments: &[Value]) -> String {
    let store_password = arguments
        .first()
        .and_then(Value::as_str)
        .unwrap_or_default();
    let signed_fields: BTreeMap<String, String> = arguments
        .get(1)
        .and_then(Value::as_object)
        .map(|field_values| {
            field_values
                .iter()
                .map(|(field_name, field_value)| {
                    let field_text = match field_value {
                        Value::String(text_value) => text_value.clone(),
                        Value::Null => String::new(),
                        other_value => other_value.to_string(),
                    };
                    (field_name.clone(), field_text)
                })
                .collect()
        })
        .unwrap_or_default();
    sign_sslcommerz_fields(store_password, &keep_verify_key_fields(signed_fields))
}

fn keep_verify_key_fields(field_texts: BTreeMap<String, String>) -> BTreeMap<String, String> {
    let Some(verify_key) = field_texts.get("verify_key").cloned() else {
        return field_texts;
    };
    let named_fields: Vec<&str> = verify_key.split(',').map(str::trim).collect();
    field_texts
        .into_iter()
        .filter(|(field_name, _)| named_fields.contains(&field_name.as_str()))
        .collect()
}

/// The standard functions plus the provider helpers the built-in templates call. Twilio's and
/// Mailgun's signatures and SSLCommerz's `verify_sign` are real. The Stripe, Razorpay, Paddle,
/// Svix and SendGrid signatures cover the rendered body, so header templates get real ones
/// from `SignedBodyFunctions`; anywhere else they have the right shape only.
#[derive(Clone)]
pub struct WebhookTemplateFunctions {
    pub standard_functions: StandardTemplateFunctions,
}

const PROVIDER_HELPER_NAMES: [&str; 9] = [
    "twilio_signature",
    "sendgrid_signature",
    "mailgun_signature",
    "svix_signature",
    "stripe_signature",
    "razorpay_signature",
    "paddle_signature",
    "whatsapp_signature",
    "sslcommerz_verify_sign",
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
            "mailgun_signature" => {
                let read_text = |position: usize| -> String {
                    match arguments.get(position) {
                        Some(Value::String(text)) => text.clone(),
                        Some(Value::Null) | None => String::new(),
                        Some(other_value) => other_value.to_string(),
                    }
                };
                sign_mailgun_token(&read_text(0), &read_text(1), &read_text(2))
            }
            "svix_signature" => format!(
                "v1,{}=",
                self.call_standard_text("random_string", &[Value::from(43)])
            ),
            "stripe_signature" => format!(
                "t={},v1={}",
                self.call_standard_text("now_unix", &[]),
                random_hex()
            ),
            "razorpay_signature" => random_hex(),
            "whatsapp_signature" => format!("sha256={}", random_hex()),
            "sendgrid_signature" => {
                STANDARD.encode(self.call_standard_text("random_string", &[Value::from(70)]))
            }
            "paddle_signature" => format!(
                "ts={};h1={}",
                self.call_standard_text("now_unix", &[]),
                random_hex()
            ),
            "sslcommerz_verify_sign" => sign_sslcommerz_arguments(arguments),
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

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn verify_sign_covers_only_the_fields_its_verify_key_names() {
        let named_fields = json!({"amount": "10.00", "status": "VALID"});
        let with_verify_key = json!({
            "amount": "10.00", "status": "VALID", "risk_title": "Safe",
            "verify_key": "amount,status",
        });

        let plain_sign = sign_sslcommerz_arguments(&[json!("testbox@ssl"), named_fields]);
        let keyed_sign = sign_sslcommerz_arguments(&[json!("testbox@ssl"), with_verify_key]);

        assert_eq!(keyed_sign, plain_sign);
        assert_eq!(keyed_sign.len(), 32);
    }
}
