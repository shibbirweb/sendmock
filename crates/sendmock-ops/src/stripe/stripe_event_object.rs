use sendmock_store::PaymentProviderObjectRecord;
use serde_json::Value;

use super::stripe_charge_object::describe_charge;
use super::stripe_checkout_session_object::{
    StripeSessionState, describe_checkout_session, read_session_id,
};
use super::stripe_dispute_object::describe_dispute;
use super::stripe_object_store::{StripeObjectKind, read_kept_or_stored_object};
use super::stripe_payment_intent_object::{
    StripeIntentState, describe_payment_intent, read_payment_intent_id,
};
use crate::payments::PaymentDetail;
use crate::{OperationContext, OperationError};

/// The object a Stripe event is about, chosen by the event's name and built as the API
/// answers it, so a webhook and a retrieve never disagree; `null` for a name Stripe does not
/// send.
pub async fn describe_stripe_event_object(
    operation_context: &OperationContext,
    payment: &PaymentDetail,
    event_name: &str,
    kept_provider_objects: &[PaymentProviderObjectRecord],
) -> Result<Value, OperationError> {
    if event_name.starts_with("checkout.session.") {
        let session_state: StripeSessionState = read_kept_or_stored_object(
            operation_context,
            kept_provider_objects,
            StripeObjectKind::CheckoutSession,
            &read_session_id(payment),
        )
        .await?;
        return Ok(describe_checkout_session(payment, &session_state));
    }
    if event_name.starts_with("charge.dispute.") {
        return Ok(describe_dispute(payment).unwrap_or(Value::Null));
    }
    if event_name.starts_with("charge.") {
        return Ok(describe_charge(payment));
    }
    if event_name.starts_with("payment_intent.") {
        let intent_state: StripeIntentState = read_kept_or_stored_object(
            operation_context,
            kept_provider_objects,
            StripeObjectKind::PaymentIntent,
            &read_payment_intent_id(payment),
        )
        .await?;
        let http_address = &operation_context.instance_details.http_address;
        return Ok(describe_payment_intent(
            payment,
            &intent_state,
            http_address,
        ));
    }
    Ok(Value::Null)
}
