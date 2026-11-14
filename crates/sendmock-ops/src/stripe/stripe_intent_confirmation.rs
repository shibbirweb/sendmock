use sendmock_payments::{describe_stripe_card_decline, find_stripe_test_card_number};
use serde_json::{Map, Value, json};

use super::stripe_call::{StripeAnswer, StripeCall};
use super::stripe_error::StripeError;
use super::stripe_intent_lookup::save_payment_intent;
use super::stripe_payment_intent_object::{
    StripeIntentState, derive_related_id, describe_payment_method, read_intent_status,
    read_payment_intent_id,
};
use crate::OperationError;
use crate::payments::{PaymentChange, PaymentDetail, PaymentStatus, pay_with_test_card};

/// Stripe refuses card numbers sent to its API; so does SendMock, keeping none of them.
pub fn refuse_raw_card_data(stripe_call: &StripeCall<'_>) -> Result<(), StripeError> {
    let has_raw_card = stripe_call
        .stripe_fields
        .find(&["payment_method_data", "card"])
        .or_else(|| stripe_call.stripe_fields.find(&["card"]))
        .is_some();
    if has_raw_card {
        return Err(StripeError::invalid_request(
            400,
            None,
            "Sending credit card numbers directly to the Stripe API is generally unsafe. We suggest you use test tokens that map to the test card you are using, see https://stripe.com/docs/testing.",
        ));
    }
    Ok(())
}

fn check_confirmable(
    payment: &PaymentDetail,
    intent_state: &StripeIntentState,
) -> Result<(), StripeError> {
    let is_confirmable = matches!(
        payment.summary.status,
        PaymentStatus::RequiresPayment | PaymentStatus::Failed | PaymentStatus::RequiresAction
    );
    if is_confirmable {
        return Ok(());
    }
    Err(StripeError::unexpected_state(format!(
        "You cannot confirm this PaymentIntent because it has a status of {}. Only a PaymentIntent with one of the following statuses may be confirmed: requires_payment_method, requires_confirmation, requires_action.",
        read_intent_status(payment, intent_state)
    )))
}

/// Stripe's `402` for a declined card, carrying the PaymentIntent as it now is.
fn build_card_error(payment: &PaymentDetail, payment_intent: Value) -> StripeError {
    let decline_reason = payment
        .summary
        .failure_code
        .as_deref()
        .unwrap_or("generic_decline");
    let card_decline = describe_stripe_card_decline(decline_reason);
    let payment_intent_id = read_payment_intent_id(payment);
    let mut extra_fields = Map::new();
    extra_fields.insert(
        "charge".to_owned(),
        json!(derive_related_id(&payment_intent_id, "ch")),
    );
    if let Some(decline_code) = card_decline.decline_code {
        extra_fields.insert("decline_code".to_owned(), json!(decline_code));
    }
    extra_fields.insert(
        "payment_method".to_owned(),
        describe_payment_method(payment, &derive_related_id(&payment_intent_id, "pm"))
            .unwrap_or(Value::Null),
    );
    extra_fields.insert("payment_intent".to_owned(), payment_intent);
    StripeError {
        status: 402,
        error_type: "card_error",
        code: Some(card_decline.code),
        message: card_decline.message.to_owned(),
        param: None,
        extra_fields,
    }
}

/// A test card the card method's table no longer lists is declined as an unknown number.
fn refuse_unlisted_card(operation_error: OperationError) -> StripeError {
    match operation_error {
        OperationError::Unprocessable { message, .. } => StripeError {
            status: 402,
            error_type: "card_error",
            code: Some("incorrect_number"),
            message: format!("Your card number is incorrect. ({message})"),
            param: Some("number".to_owned()),
            extra_fields: Map::new(),
        },
        other_error => other_error.into(),
    }
}

/// Confirms with the PaymentMethod sent or attached, runs the card through the card method's
/// test table, stores the outcome and answers the PaymentIntent, or Stripe's card error.
pub async fn confirm_payment_intent(
    stripe_call: &StripeCall<'_>,
    mut payment_change: PaymentChange<'_>,
    mut intent_state: StripeIntentState,
) -> StripeAnswer {
    refuse_raw_card_data(stripe_call)?;
    let stripe_fields = &stripe_call.stripe_fields;
    if let Some(payment_method) = stripe_fields.text(&["payment_method"]) {
        intent_state.payment_method = Some(payment_method);
    }
    if let Some(return_url) = stripe_fields.text(&["return_url"]) {
        intent_state.return_url = Some(return_url);
    }
    check_confirmable(&payment_change.payment, &intent_state)?;
    let payment_method = intent_state.payment_method.clone().ok_or_else(|| {
        StripeError::unexpected_state("You cannot confirm this PaymentIntent because it's missing a payment method. You can either update the PaymentIntent with a payment method and then confirm it again, or confirm it again directly with a payment method.")
    })?;
    let card_number = find_stripe_test_card_number(&payment_method).ok_or_else(|| {
        StripeError::invalid_request(
            400,
            Some("resource_missing"),
            format!("No such PaymentMethod: '{payment_method}'"),
        )
        .with_param("payment_method")
    })?;
    pay_with_test_card(
        &mut payment_change,
        stripe_call.operation_context,
        card_number,
    )
    .await
    .map_err(refuse_unlisted_card)?;
    if payment_change.payment.summary.status == PaymentStatus::Failed {
        intent_state.payment_method = None;
    }
    let (payment, payment_intent) =
        save_payment_intent(stripe_call, payment_change, &intent_state).await?;
    if payment.summary.status == PaymentStatus::Failed {
        return Err(build_card_error(&payment, payment_intent));
    }
    Ok(payment_intent)
}
