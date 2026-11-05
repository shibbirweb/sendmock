use sendmock_store::PaymentProviderObjectRecord;
use serde_json::Value;

use super::payment_views::PaymentDetail;
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
    Ok(Value::Null)
}
