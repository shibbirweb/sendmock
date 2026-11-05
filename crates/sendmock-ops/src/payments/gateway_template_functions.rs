use std::fmt::Write;
use std::sync::Arc;

use hmac::{Hmac, KeyInit, Mac};
use sendmock_core::{StandardTemplateFunctions, TemplateFunctions};
use serde_json::Value;
use sha2::Sha256;

/// The standard functions plus `stripe_signature`, which signs the notification body already
/// rendered (empty for redirect fields) at the event's time.
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
            _ => self
                .standard_functions
                .call_function(function_name, arguments),
        }
    }

    fn function_names(&self) -> Vec<&'static str> {
        let mut function_names = self.standard_functions.function_names();
        function_names.push("stripe_signature");
        function_names
    }

    fn to_shared(&self) -> Arc<dyn TemplateFunctions> {
        Arc::new(self.clone())
    }
}

/// `Stripe-Signature`: `t=<timestamp>,v1=<hex HMAC-SHA256 of "<timestamp>.<body>">`, keyed by
/// the endpoint's signing secret, as Stripe's libraries check it.
pub fn sign_stripe_payload(webhook_secret: &str, timestamp_seconds: i64, payload: &str) -> String {
    let Ok(mut mac) = <Hmac<Sha256> as KeyInit>::new_from_slice(webhook_secret.as_bytes()) else {
        return String::new();
    };
    mac.update(format!("{timestamp_seconds}.{payload}").as_bytes());
    let signature_hex =
        mac.finalize()
            .into_bytes()
            .iter()
            .fold(String::new(), |mut hex_text, byte| {
                let _ = write!(hex_text, "{byte:02x}");
                hex_text
            });
    format!("t={timestamp_seconds},v1={signature_hex}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn signs_the_timestamp_and_body_as_stripe_does() {
        let signature = sign_stripe_payload("whsec_test", 1_700_000_000, "{}");

        assert_eq!(
            signature,
            "t=1700000000,v1=35495024f4ef3f94e5a93e22221544c4b75e9a42300cd965ab81cb85cd994e91"
        );
    }
}
