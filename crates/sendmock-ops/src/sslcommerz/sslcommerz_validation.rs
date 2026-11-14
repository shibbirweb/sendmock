use sendmock_core::format_rfc3339;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use super::sslcommerz_call::{SSLCOMMERZ_PROVIDER_KEY, SslcommerzCall};
use super::sslcommerz_transaction::{describe_sslcommerz_transaction, format_dhaka_time, is_paid};
use crate::payments::{ProviderObjectKey, find_provider_object, save_provider_object};
use crate::{OperationContext, OperationError};

const VALIDATION_OBJECT_KIND: &str = "validation";

/// When the app first validated the order; later calls answer `VALIDATED`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct OrderValidation {
    pub validated_on: String,
}

fn validation_key(val_id: &str) -> ProviderObjectKey<'_> {
    ProviderObjectKey {
        provider: SSLCOMMERZ_PROVIDER_KEY,
        object_kind: VALIDATION_OBJECT_KIND,
        object_id: val_id,
    }
}

/// The app's first validation of the order, if it validated it.
pub async fn find_order_validation(
    operation_context: &OperationContext,
    val_id: &str,
) -> Result<Option<OrderValidation>, OperationError> {
    Ok(
        find_provider_object::<OrderValidation>(operation_context, validation_key(val_id))
            .await?
            .map(|(_, order_validation)| order_validation),
    )
}

/// `GET /validator/api/validationserverAPI.php`: the transaction the IPN carried, `VALID` the
/// first time and `VALIDATED` after, or SSLCommerz's refusal.
pub async fn validate_order(sslcommerz_call: &SslcommerzCall<'_>) -> Result<Value, OperationError> {
    if !sslcommerz_call.has_store_credentials() {
        return Ok(json!({"APIConnect": "FAILED"}));
    }
    let Some(val_id) = sslcommerz_call.read_field("val_id") else {
        return Ok(json!({"APIConnect": "INVALID_REQUEST"}));
    };
    let paid_payment = sslcommerz_call
        .find_payment("val_id", val_id)
        .await?
        .filter(is_paid);
    let Some(payment) = paid_payment else {
        return Ok(json!({"status": "INVALID_TRANSACTION", "APIConnect": "DONE"}));
    };
    let operation_context = sslcommerz_call.operation_context;
    let earlier_validation = find_order_validation(operation_context, val_id).await?;
    let (transaction_status, order_validation) = match earlier_validation {
        Some(order_validation) => ("VALIDATED", order_validation),
        None => {
            let now_unix_ms = operation_context.clock.now_unix_ms();
            let order_validation = OrderValidation {
                validated_on: format_dhaka_time(&format_rfc3339(now_unix_ms)),
            };
            save_provider_object(
                operation_context,
                validation_key(val_id),
                &payment.summary.id,
                &order_validation,
            )
            .await?;
            ("VALID", order_validation)
        }
    };
    let mut validated_order = describe_sslcommerz_transaction(&payment, transaction_status);
    validated_order.remove("verify_key");
    let answered_fields = [
        ("emi_instalment", "0"),
        ("emi_amount", "0.00"),
        ("emi_description", ""),
        ("emi_issuer", ""),
        ("account_details", ""),
        ("APIConnect", "DONE"),
        ("validated_on", order_validation.validated_on.as_str()),
        ("gw_version", ""),
    ];
    for (field_name, field_value) in answered_fields {
        validated_order.insert(field_name.to_owned(), Value::from(field_value));
    }
    Ok(Value::Object(validated_order))
}
