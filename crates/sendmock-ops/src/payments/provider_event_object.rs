use sendmock_store::PaymentProviderObjectRecord;
use serde_json::Value;

use super::payment_views::PaymentDetail;
use crate::paypal::{PAYPAL_PROVIDER_KEY, describe_paypal_event_object};
use crate::sslcommerz::{SSLCOMMERZ_PROVIDER_KEY, describe_sslcommerz_transaction};
use crate::stripe::{STRIPE_PROVIDER_KEY, describe_stripe_event_object};
use crate::{OperationContext, OperationError};

/// The gateway's own object a payment event is about, as its webhook carries it and its
/// templates read it as `event.object`; `null` for a gateway that has none.
pub async fn build_provider_event_object(
    operation_context: &OperationContext,
    gateway_key: &str,
    payment: &PaymentDetail,
    event_name: &str,
    kept_provider_objects: &[PaymentProviderObjectRecord],
) -> Result<Value, OperationError> {
    if gateway_key == STRIPE_PROVIDER_KEY {
        return describe_stripe_event_object(
            operation_context,
            payment,
            event_name,
            kept_provider_objects,
        )
        .await;
    }
    if gateway_key == PAYPAL_PROVIDER_KEY {
        return describe_paypal_event_object(
            operation_context,
            payment,
            event_name,
            kept_provider_objects,
        )
        .await;
    }
    Ok(build_provider_redirect_object(
        gateway_key,
        payment,
        event_name,
    ))
}

/// The gateway's own object its redirect fields read as `event.object`, with
/// `redirect_status` the gateway's name for the outcome; `null` for a gateway that has none.
pub fn build_provider_redirect_object(
    gateway_key: &str,
    payment: &PaymentDetail,
    redirect_status: &str,
) -> Value {
    if gateway_key == SSLCOMMERZ_PROVIDER_KEY {
        return Value::Object(describe_sslcommerz_transaction(payment, redirect_status));
    }
    Value::Null
}
