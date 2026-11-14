use super::stripe_call::StripeCall;
use super::stripe_error::StripeError;
use super::stripe_object_store::{
    STRIPE_PROVIDER_KEY, StripeObjectKind, keep_stripe_object, load_stripe_object,
};
use super::stripe_payment_intent_object::{StripeIntentState, describe_payment_intent};
use crate::OperationError;
use crate::payments::{PaymentChange, PaymentDetail, read_payment_document};

/// The Stripe payment that has this id under `id_name` (`payment_intent`, `checkout_session`).
pub async fn find_stripe_payment(
    stripe_call: &StripeCall<'_>,
    id_name: &str,
    provider_id: &str,
) -> Result<Option<PaymentDetail>, StripeError> {
    let stored_payment = stripe_call
        .operation_context
        .payment_repository
        .find_payment_by_provider_id(STRIPE_PROVIDER_KEY, provider_id)
        .await
        .map_err(OperationError::from)?;
    let Some(stored_payment) = stored_payment else {
        return Ok(None);
    };
    let payment = read_payment_document(&stored_payment)?;
    let has_this_id = payment.provider_ids.get(id_name).map(String::as_str) == Some(provider_id);
    Ok(has_this_id.then_some(payment))
}

/// A PaymentIntent's payment, ready to change, with what Stripe keeps beside it.
pub async fn load_payment_intent<'call>(
    stripe_call: &StripeCall<'call>,
    payment_intent_id: &str,
) -> Result<(PaymentChange<'call>, StripeIntentState), StripeError> {
    let payment = find_stripe_payment(stripe_call, "payment_intent", payment_intent_id)
        .await?
        .ok_or_else(|| {
            StripeError::resource_missing("payment_intent", payment_intent_id, "intent")
        })?;
    let intent_state = load_stripe_object(
        stripe_call.operation_context,
        StripeObjectKind::PaymentIntent,
        payment_intent_id,
    )
    .await?;
    let payment_change =
        PaymentChange::start(stripe_call.operation_context, payment, Vec::new()).await;
    Ok((payment_change, intent_state))
}

/// Stores the change and the intent's own state, and answers the PaymentIntent.
pub async fn save_payment_intent(
    stripe_call: &StripeCall<'_>,
    mut payment_change: PaymentChange<'_>,
    intent_state: &StripeIntentState,
) -> Result<(PaymentDetail, serde_json::Value), StripeError> {
    let payment_intent_id =
        super::stripe_payment_intent_object::read_payment_intent_id(&payment_change.payment);
    keep_stripe_object(
        &mut payment_change,
        StripeObjectKind::PaymentIntent,
        &payment_intent_id,
        intent_state,
    )?;
    let payment = payment_change.save().await?;
    let payment_intent =
        describe_payment_intent(&payment, intent_state, stripe_call.http_address());
    Ok((payment, payment_intent))
}
