use serde_json::{Map, Value};

use super::bkash_error::BkashError;
use crate::payments::{PaymentDetail, PaymentGatewayFields, read_payment_document};
use crate::providers::ProviderHttpRequest;
use crate::{OperationContext, OperationError};

pub const BKASH_PROVIDER_KEY: &str = "bkash";

/// One request to bKash's API: its headers and JSON body.
pub struct BkashCall<'call> {
    pub operation_context: &'call OperationContext,
    pub gateway_fields: &'call PaymentGatewayFields,
    pub request: &'call ProviderHttpRequest,
    pub body_fields: Map<String, Value>,
}

impl BkashCall<'_> {
    /// The body field as text (bKash sends amounts as strings, some clients as numbers), none
    /// when it is missing or blank.
    pub fn read_field(&self, field_name: &str) -> Option<String> {
        let field_text = match self.body_fields.get(field_name)? {
            Value::String(field_text) => field_text.trim().to_owned(),
            Value::Number(field_number) => field_number.to_string(),
            _ => return None,
        };
        Some(field_text).filter(|field_text| !field_text.is_empty())
    }

    pub fn read_credential(&self, credential_name: &str) -> Option<&str> {
        self.gateway_fields
            .credentials
            .iter()
            .find(|credential| credential.name == credential_name)
            .map(|credential| credential.value.as_str())
    }

    fn is_credential(&self, credential_name: &str, sent_value: Option<&str>) -> bool {
        sent_value
            .is_some_and(|sent_value| self.read_credential(credential_name) == Some(sent_value))
    }

    /// The token calls send the app key and secret in the body.
    pub fn has_app_credentials_in_body(&self) -> bool {
        self.is_credential("app_key", self.read_field("app_key").as_deref())
            && self.is_credential("app_secret", self.read_field("app_secret").as_deref())
    }

    /// The token calls send the merchant's username and password as headers.
    pub fn has_merchant_login(&self) -> bool {
        self.is_credential("username", self.request.header("username"))
            && self.is_credential("password", self.request.header("password"))
    }

    /// The payment calls send the id token and the app key as headers.
    pub fn check_payment_headers(&self) -> Result<(), BkashError> {
        let has_token = self
            .request
            .header("authorization")
            .is_some_and(|authorization| !authorization.trim().is_empty());
        if !has_token {
            return Err(BkashError::INVALID_TOKEN);
        }
        if !self.is_credential("app_key", self.request.header("x-app-key")) {
            return Err(BkashError::INVALID_APP_KEY);
        }
        Ok(())
    }

    /// The bKash payment with this `paymentID`.
    pub async fn find_payment(
        &self,
        payment_id: &str,
    ) -> Result<Option<PaymentDetail>, OperationError> {
        let stored_payment = self
            .operation_context
            .payment_repository
            .find_payment_by_provider_id(BKASH_PROVIDER_KEY, payment_id)
            .await?;
        let payment = stored_payment
            .map(|stored_payment| read_payment_document(&stored_payment))
            .transpose()?;
        Ok(payment.filter(|payment| {
            payment.provider_ids.get("payment_id").map(String::as_str) == Some(payment_id)
        }))
    }
}
