use std::collections::BTreeMap;

use crate::OperationContext;
use crate::payments::PaymentGatewayFields;

pub const SSLCOMMERZ_PROVIDER_KEY: &str = "sslcommerz";

/// One request to SSLCommerz's API: its query and form fields, the form's winning on a clash.
pub struct SslcommerzCall<'call> {
    pub operation_context: &'call OperationContext,
    pub gateway_fields: &'call PaymentGatewayFields,
    pub request_fields: BTreeMap<String, String>,
}

impl SslcommerzCall<'_> {
    /// The field's value, none when it is missing or blank.
    pub fn read_field(&self, field_name: &str) -> Option<&str> {
        self.request_fields
            .get(field_name)
            .map(|field_value| field_value.trim())
            .filter(|field_value| !field_value.is_empty())
    }

    fn read_credential(&self, credential_name: &str) -> Option<&str> {
        self.gateway_fields
            .credentials
            .iter()
            .find(|credential| credential.name == credential_name)
            .map(|credential| credential.value.as_str())
    }

    /// Whether `store_id` and `store_passwd` are the gateway's.
    pub fn has_store_credentials(&self) -> bool {
        ["store_id", "store_passwd"].iter().all(|credential_name| {
            self.read_field(credential_name)
                .is_some_and(|sent_value| self.read_credential(credential_name) == Some(sent_value))
        })
    }
}
