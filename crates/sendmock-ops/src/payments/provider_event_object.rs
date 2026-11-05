use sendmock_store::PaymentProviderObjectRecord;
use serde_json::Value;

use super::payment_gateway_views::PaymentGatewayFields;
use super::payment_views::PaymentDetail;
use crate::paypal::{PAYPAL_PROVIDER_KEY, describe_paypal_event_object};
use crate::razorpay::{
    RAZORPAY_PROVIDER_KEY, describe_razorpay_event_object, describe_razorpay_redirect_object,
};
use crate::sslcommerz::{SSLCOMMERZ_PROVIDER_KEY, describe_sslcommerz_transaction};
use crate::stripe::{STRIPE_PROVIDER_KEY, describe_stripe_event_object};
use crate::{OperationContext, OperationError};

/// The gateway's own object a payment event is about, as its webhook carries it and its
/// templates read it as `event.object`; `null` for a gateway that has none.
pub async fn build_provider_event_object(
    operation_context: &OperationContext,
    gateway_fields: &PaymentGatewayFields,
    payment: &PaymentDetail,
    event_name: &str,
    kept_provider_objects: &[PaymentProviderObjectRecord],
) -> Result<Value, OperationError> {
    let gateway_key = gateway_fields.key.as_str();
    if gateway_key == RAZORPAY_PROVIDER_KEY {
        return describe_razorpay_event_object(
            operation_context,
            gateway_fields,
            payment,
            event_name,
            kept_provider_objects,
        )
        .await;
    }
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
        gateway_fields,
        payment,
        event_name,
    ))
}

/// The gateway's own object its redirect fields read as `event.object`, with
/// `redirect_status` the gateway's name for the outcome; `null` for a gateway that has none.
pub fn build_provider_redirect_object(
    gateway_fields: &PaymentGatewayFields,
    payment: &PaymentDetail,
    redirect_status: &str,
) -> Value {
    if gateway_fields.key == SSLCOMMERZ_PROVIDER_KEY {
        return Value::Object(describe_sslcommerz_transaction(payment, redirect_status));
    }
    if gateway_fields.key == RAZORPAY_PROVIDER_KEY {
        return Value::Object(describe_razorpay_redirect_object(gateway_fields, payment));
    }
    Value::Null
}
