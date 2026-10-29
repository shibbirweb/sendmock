use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use hmac::{Hmac, KeyInit, Mac};
use sendmock_core::{StandardTemplateFunctions, TemplateFunctions};
use serde_json::Value;
use sha1::Sha1;

/// The standard functions plus the signature helpers callback templates use.
pub struct CallbackTemplateFunctions {
    pub standard_functions: StandardTemplateFunctions,
}

impl TemplateFunctions for CallbackTemplateFunctions {
    fn call_function(&self, function_name: &str, arguments: &[Value]) -> Option<Value> {
        match function_name {
            "twilio_signature" => {
                let text_argument = |index: usize| {
                    arguments
                        .get(index)
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_owned()
                };
                Some(Value::from(sign_twilio_request(
                    &text_argument(0),
                    arguments.get(1).unwrap_or(&Value::Null),
                    &text_argument(2),
                )))
            }
            _ => self
                .standard_functions
                .call_function(function_name, arguments),
        }
    }
}

/// `X-Twilio-Signature`: Base64 of HMAC-SHA1, keyed by the auth token, over the URL followed by
/// each form field's name and value, sorted by name (repeated values in their order).
pub fn sign_twilio_request(callback_url: &str, form_fields: &Value, auth_token: &str) -> String {
    let mut signed_text = callback_url.to_owned();
    if let Value::Object(fields) = form_fields {
        let mut field_names: Vec<&String> = fields.keys().collect();
        field_names.sort();
        for field_name in field_names {
            let field_values = match &fields[field_name] {
                Value::Array(values) => values.iter().map(text_of).collect(),
                single_value => vec![text_of(single_value)],
            };
            for field_value in field_values {
                signed_text.push_str(field_name);
                signed_text.push_str(&field_value);
            }
        }
    }
    let Ok(mut mac) = <Hmac<Sha1> as KeyInit>::new_from_slice(auth_token.as_bytes()) else {
        return String::new();
    };
    mac.update(signed_text.as_bytes());
    STANDARD.encode(mac.finalize().into_bytes())
}

fn text_of(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other_value => other_value.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    // AC: SM-08.2
    #[test]
    fn signs_like_twilios_documented_example() {
        let form_fields = json!({
            "CallSid": "CA1234567890ABCDE",
            "Caller": "+14158675310",
            "Digits": "1234",
            "From": "+14158675310",
            "To": "+18005551212",
        });

        let signature = sign_twilio_request(
            "https://mycompany.com/myapp.php?foo=1&bar=2",
            &form_fields,
            "12345",
        );

        assert_eq!(signature, "GvWf1cFY/Q7PnoempGyD5oXAezc=");
    }
}
