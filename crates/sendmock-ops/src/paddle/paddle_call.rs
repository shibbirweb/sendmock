use serde_json::{Map, Value};

use super::paddle_error::PaddleError;
use crate::payments::{PaymentDetail, PaymentGatewayFields, read_payment_document};
use crate::providers::ProviderHttpRequest;
use crate::{OperationContext, OperationError};

pub const PADDLE_PROVIDER_KEY: &str = "paddle";

/// One request to Paddle's API: its JSON body, authenticated with the API key.
pub struct PaddleCall<'call> {
    pub operation_context: &'call OperationContext,
    pub gateway_fields: &'call PaymentGatewayFields,
    pub request: &'call ProviderHttpRequest,
    pub body_fields: Map<String, Value>,
}

impl PaddleCall<'_> {
    pub fn read_credential(&self, credential_name: &str) -> &str {
        self.gateway_fields
            .credentials
            .iter()
            .find(|credential| credential.name == credential_name)
            .map_or("", |credential| credential.value.as_str())
    }

    /// `Authorization: Bearer` with the gateway's API key.
    pub fn check_api_key(&self) -> Result<(), PaddleError> {
        let sent_key = self
            .request
            .header("authorization")
            .and_then(|authorization| authorization.strip_prefix("Bearer "))
            .map(str::trim);
        match sent_key {
            None | Some("") => Err(PaddleError::authentication_missing()),
            Some(sent_key) if sent_key == self.read_credential("api_key") => Ok(()),
            Some(_) => Err(PaddleError::forbidden()),
        }
    }

    pub fn read_text(&self, field_name: &str) -> Option<String> {
        self.body_fields
            .get(field_name)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|field_text| !field_text.is_empty())
            .map(str::to_owned)
    }

    /// The Paddle payment with this `txn_` id.
    pub async fn find_transaction(
        &self,
        transaction_id: &str,
    ) -> Result<Option<PaymentDetail>, OperationError> {
        let stored_payment = self
            .operation_context
            .payment_repository
            .find_payment_by_provider_id(PADDLE_PROVIDER_KEY, transaction_id)
            .await?;
        let payment = stored_payment
            .map(|stored_payment| read_payment_document(&stored_payment))
            .transpose()?;
        Ok(payment.filter(|payment| {
            payment.provider_ids.get("transaction").map(String::as_str) == Some(transaction_id)
        }))
    }
}
