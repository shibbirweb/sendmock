use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use serde_json::{Map, Value};

use super::razorpay_error::RazorpayError;
use crate::payments::{PaymentDetail, PaymentGatewayFields, read_payment_document};
use crate::providers::ProviderHttpRequest;
use crate::{OperationContext, OperationError};

pub const RAZORPAY_PROVIDER_KEY: &str = "razorpay";

/// One request to Razorpay's API: its JSON (or form) body, authenticated with the key.
pub struct RazorpayCall<'call> {
    pub operation_context: &'call OperationContext,
    pub gateway_fields: &'call PaymentGatewayFields,
    pub request: &'call ProviderHttpRequest,
    pub body_fields: Map<String, Value>,
}

/// The body as JSON, or a form's fields as text (Razorpay takes both).
pub fn read_body_fields(request: &ProviderHttpRequest) -> Map<String, Value> {
    if let Ok(Value::Object(json_fields)) = serde_json::from_slice::<Value>(&request.body) {
        return json_fields;
    }
    let form_pairs: Vec<(String, String)> =
        serde_urlencoded::from_bytes(&request.body).unwrap_or_default();
    form_pairs
        .into_iter()
        .map(|(field_name, field_value)| (field_name, Value::from(field_value)))
        .collect()
}

fn read_basic_pair(request: &ProviderHttpRequest) -> Option<(String, String)> {
    let encoded_pair = request.header("authorization")?.strip_prefix("Basic ")?;
    let decoded_pair = STANDARD.decode(encoded_pair.trim()).ok()?;
    let pair_text = String::from_utf8_lossy(&decoded_pair).into_owned();
    let (key_id, key_secret) = pair_text.split_once(':')?;
    Some((key_id.to_owned(), key_secret.to_owned()))
}

impl RazorpayCall<'_> {
    pub fn read_credential(&self, credential_name: &str) -> &str {
        self.gateway_fields
            .credentials
            .iter()
            .find(|credential| credential.name == credential_name)
            .map_or("", |credential| credential.value.as_str())
    }

    /// Basic auth with the gateway's key id and key secret.
    pub fn check_key(&self) -> Result<(), RazorpayError> {
        let expected_pair = (
            self.read_credential("key_id"),
            self.read_credential("key_secret"),
        );
        match read_basic_pair(self.request) {
            Some((key_id, key_secret))
                if (key_id.as_str(), key_secret.as_str()) == expected_pair =>
            {
                Ok(())
            }
            _ => Err(RazorpayError::authentication_failed()),
        }
    }

    pub fn read_field(&self, field_name: &str) -> Option<&Value> {
        self.body_fields
            .get(field_name)
            .filter(|field_value| !field_value.is_null())
    }

    /// A whole number sent as a number or as text, as amounts are.
    pub fn read_whole_number(&self, field_name: &str) -> Option<u64> {
        match self.read_field(field_name)? {
            Value::Number(field_number) => field_number.as_u64(),
            Value::String(field_text) => field_text.trim().parse().ok(),
            _ => None,
        }
    }

    pub fn read_text(&self, field_name: &str) -> Option<String> {
        match self.read_field(field_name)? {
            Value::String(field_text) => {
                Some(field_text.trim().to_owned()).filter(|text| !text.is_empty())
            }
            Value::Number(field_number) => Some(field_number.to_string()),
            _ => None,
        }
    }

    /// The Razorpay payment whose `id_name` (`order` or `payment`) is `id_value`.
    pub async fn find_payment(
        &self,
        id_name: &str,
        id_value: &str,
    ) -> Result<Option<PaymentDetail>, OperationError> {
        let stored_payment = self
            .operation_context
            .payment_repository
            .find_payment_by_provider_id(RAZORPAY_PROVIDER_KEY, id_value)
            .await?;
        let payment = stored_payment
            .map(|stored_payment| read_payment_document(&stored_payment))
            .transpose()?;
        Ok(payment.filter(|payment| {
            payment.provider_ids.get(id_name).map(String::as_str) == Some(id_value)
        }))
    }
}
