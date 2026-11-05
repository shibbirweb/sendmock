use sendmock_payments::is_currency_code;

use super::stripe_call::{StripeAnswer, StripeCall};
use super::stripe_error::StripeError;
use super::stripe_fields::StripeFields;
use super::stripe_intent_confirmation::{confirm_payment_intent, refuse_raw_card_data};
use super::stripe_intent_lookup::{load_payment_intent, save_payment_intent};
use super::stripe_object_store::STRIPE_PROVIDER_KEY;
use super::stripe_payment_intent_object::{
    StripeIntentState, describe_payment_intent, read_intent_status,
};
use crate::payments::{
    PaymentCaptureMethod, PaymentLineItem, PaymentStatus, ProviderPaymentRequest,
    start_provider_payment,
};

const CANCELLATION_REASONS: [&str; 4] = [
    "duplicate",
    "fraudulent",
    "requested_by_customer",
    "abandoned",
];

/// A three-letter currency, in capitals as payments keep it.
pub fn read_currency(
    stripe_fields: &StripeFields,
    field_path: &[&str],
) -> Result<String, StripeError> {
    let currency = stripe_fields
        .required_text(field_path)?
        .to_ascii_uppercase();
    if !is_currency_code(&currency) {
        return Err(StripeError::invalid_value(
            &super::stripe_fields::describe_param(field_path),
            format!("Invalid currency: {}.", currency.to_ascii_lowercase()),
        ));
    }
    Ok(currency)
}

/// `automatic` and `automatic_async` capture at once; `manual` waits for a capture.
pub fn read_capture_method(
    stripe_fields: &StripeFields,
    field_path: &[&str],
) -> Result<PaymentCaptureMethod, StripeError> {
    match stripe_fields.text(field_path).as_deref() {
        None | Some("automatic" | "automatic_async") => Ok(PaymentCaptureMethod::Automatic),
        Some("manual") => Ok(PaymentCaptureMethod::Manual),
        Some(_) => Err(StripeError::invalid_value(
            &super::stripe_fields::describe_param(field_path),
            "Invalid capture_method: must be one of automatic, automatic_async, or manual",
        )),
    }
}

/// `POST /v1/payment_intents`, confirmed at once with `confirm=true`.
pub async fn create_payment_intent(stripe_call: &StripeCall<'_>) -> StripeAnswer {
    let stripe_fields = &stripe_call.stripe_fields;
    let amount_minor = stripe_fields
        .positive_amount(&["amount"])?
        .ok_or_else(|| StripeError::missing_param("amount"))?;
    let currency = read_currency(stripe_fields, &["currency"])?;
    let capture_method = read_capture_method(stripe_fields, &["capture_method"])?;
    refuse_raw_card_data(stripe_call)?;
    let description = stripe_fields.text(&["description"]);
    let payment_request = ProviderPaymentRequest {
        provider: STRIPE_PROVIDER_KEY.to_owned(),
        amount_minor,
        currency,
        customer_email: stripe_fields.text(&["receipt_email"]),
        line_items: vec![PaymentLineItem {
            name: description.clone().unwrap_or_else(|| "Payment".to_owned()),
            quantity: 1,
            unit_amount_minor: amount_minor,
        }],
        metadata: stripe_fields.metadata(&["metadata"]),
        capture_method,
        checkout: None,
    };
    let payment_change =
        start_provider_payment(stripe_call.operation_context, payment_request).await?;
    let intent_state = StripeIntentState {
        payment_method: stripe_fields.text(&["payment_method"]),
        description,
        return_url: stripe_fields.text(&["return_url"]),
        ..StripeIntentState::default()
    };
    if stripe_fields.is_true(&["confirm"]) {
        return confirm_payment_intent(stripe_call, payment_change, intent_state).await;
    }
    Ok(
        save_payment_intent(stripe_call, payment_change, &intent_state)
            .await?
            .1,
    )
}

pub async fn retrieve_payment_intent(
    stripe_call: &StripeCall<'_>,
    payment_intent_id: &str,
) -> StripeAnswer {
    let (payment_change, intent_state) =
        load_payment_intent(stripe_call, payment_intent_id).await?;
    Ok(describe_payment_intent(
        &payment_change.payment,
        &intent_state,
        stripe_call.http_address(),
    ))
}

pub async fn confirm_existing_payment_intent(
    stripe_call: &StripeCall<'_>,
    payment_intent_id: &str,
) -> StripeAnswer {
    let (payment_change, intent_state) =
        load_payment_intent(stripe_call, payment_intent_id).await?;
    confirm_payment_intent(stripe_call, payment_change, intent_state).await
}

/// Captures an authorized PaymentIntent in whole or, with `amount_to_capture`, in part.
pub async fn capture_payment_intent(
    stripe_call: &StripeCall<'_>,
    payment_intent_id: &str,
) -> StripeAnswer {
    let (mut payment_change, intent_state) =
        load_payment_intent(stripe_call, payment_intent_id).await?;
    let payment = &payment_change.payment;
    if payment.summary.status != PaymentStatus::Authorized {
        return Err(StripeError::unexpected_state(format!(
            "This PaymentIntent could not be captured because it has a status of {}. Only a PaymentIntent with one of the following statuses may be captured: requires_capture.",
            read_intent_status(payment, &intent_state)
        )));
    }
    let amount_minor = payment.summary.amount_minor;
    let capture_minor = stripe_call
        .stripe_fields
        .positive_amount(&["amount_to_capture"])?
        .unwrap_or(amount_minor);
    if capture_minor > amount_minor {
        return Err(StripeError::invalid_request(
            400,
            Some("amount_too_large"),
            "The amount to capture must be less than or equal to the amount of the PaymentIntent.",
        )
        .with_param("amount_to_capture"));
    }
    payment_change.capture(capture_minor);
    Ok(
        save_payment_intent(stripe_call, payment_change, &intent_state)
            .await?
            .1,
    )
}

/// Cancels a PaymentIntent that is not paid; an authorized one is voided.
pub async fn cancel_payment_intent(
    stripe_call: &StripeCall<'_>,
    payment_intent_id: &str,
) -> StripeAnswer {
    let (mut payment_change, mut intent_state) =
        load_payment_intent(stripe_call, payment_intent_id).await?;
    let cancellation_reason = stripe_call.stripe_fields.text(&["cancellation_reason"]);
    if cancellation_reason
        .as_deref()
        .is_some_and(|reason| !CANCELLATION_REASONS.contains(&reason))
    {
        return Err(StripeError::invalid_value(
            "cancellation_reason",
            "Invalid cancellation_reason: must be one of duplicate, fraudulent, requested_by_customer, or abandoned",
        ));
    }
    match payment_change.payment.summary.status {
        PaymentStatus::Authorized => payment_change.void_authorization(),
        PaymentStatus::RequiresPayment | PaymentStatus::RequiresAction | PaymentStatus::Failed => {
            payment_change.cancel_by_merchant();
        }
        _ => {
            return Err(StripeError::unexpected_state(format!(
                "You cannot cancel this PaymentIntent because it has a status of {}. Only a PaymentIntent with one of the following statuses may be canceled: requires_payment_method, requires_capture, requires_confirmation, requires_action, processing.",
                read_intent_status(&payment_change.payment, &intent_state)
            )));
        }
    }
    intent_state.cancellation_reason = cancellation_reason;
    intent_state.canceled_at = Some(stripe_call.now_seconds());
    Ok(
        save_payment_intent(stripe_call, payment_change, &intent_state)
            .await?
            .1,
    )
}
