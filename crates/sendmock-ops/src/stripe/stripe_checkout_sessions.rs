use super::stripe_call::{StripeAnswer, StripeCall};
use super::stripe_checkout_line_items::read_checkout_line_items;
use super::stripe_checkout_session_object::{
    StripeSessionState, describe_checkout_session, describe_session_line_items, read_session_id,
    read_session_status,
};
use super::stripe_error::StripeError;
use super::stripe_intent_lookup::find_stripe_payment;
use super::stripe_object_store::{
    STRIPE_PROVIDER_KEY, StripeObjectKind, keep_stripe_object, load_stripe_object,
};
use super::stripe_payment_intent_object::{StripeIntentState, read_payment_intent_id};
use super::stripe_payment_intents::read_capture_method;
use crate::payments::{
    PaymentChange, PaymentDetail, ProviderCheckoutUrls, ProviderPaymentRequest,
    apply_checkout_outcome_profile, start_provider_payment,
};

/// Stripe fills `{CHECKOUT_SESSION_ID}` in the return URLs with the session's id.
fn fill_session_id(return_url: Option<String>, session_id: &str) -> Option<String> {
    return_url.map(|return_url| return_url.replace("{CHECKOUT_SESSION_ID}", session_id))
}

fn build_session_request(
    stripe_call: &StripeCall<'_>,
) -> Result<ProviderPaymentRequest, StripeError> {
    let stripe_fields = &stripe_call.stripe_fields;
    let mode = stripe_fields.required_text(&["mode"])?;
    if mode != "payment" {
        return Err(StripeError::invalid_value(
            "mode",
            format!(
                "SendMock emulates Checkout Sessions in payment mode; {mode} mode is not available yet."
            ),
        ));
    }
    let checkout_line_items = read_checkout_line_items(stripe_fields)?;
    Ok(ProviderPaymentRequest {
        provider: STRIPE_PROVIDER_KEY.to_owned(),
        amount_minor: checkout_line_items.total_minor(),
        currency: checkout_line_items.currency,
        customer_email: stripe_fields.text(&["customer_email"]),
        line_items: checkout_line_items.line_items,
        metadata: stripe_fields.metadata(&["metadata"]),
        capture_method: read_capture_method(
            stripe_fields,
            &["payment_intent_data", "capture_method"],
        )?,
        checkout: Some(ProviderCheckoutUrls {
            success_url: stripe_fields.text(&["success_url"]),
            cancel_url: stripe_fields.text(&["cancel_url"]),
        }),
    })
}

async fn save_session(
    mut payment_change: PaymentChange<'_>,
    session_state: &StripeSessionState,
) -> StripeAnswer {
    let session_id = read_session_id(&payment_change.payment);
    keep_stripe_object(
        &mut payment_change,
        StripeObjectKind::CheckoutSession,
        &session_id,
        session_state,
    )?;
    let payment = payment_change.save().await?;
    Ok(describe_checkout_session(&payment, session_state))
}

/// `POST /v1/checkout/sessions` in `payment` mode: a payment with this instance's checkout page.
pub async fn create_checkout_session(stripe_call: &StripeCall<'_>) -> StripeAnswer {
    let operation_context = stripe_call.operation_context;
    let stripe_fields = &stripe_call.stripe_fields;
    let session_request = build_session_request(stripe_call)?;
    let mut payment_change = start_provider_payment(operation_context, session_request).await?;
    let session_id = read_session_id(&payment_change.payment);
    let payment = &mut payment_change.payment;
    payment.success_url = fill_session_id(payment.success_url.take(), &session_id);
    payment.cancel_url = fill_session_id(payment.cancel_url.take(), &session_id);
    apply_checkout_outcome_profile(&mut payment_change, operation_context).await?;
    let intent_state = StripeIntentState {
        description: stripe_fields.text(&["payment_intent_data", "description"]),
        metadata: Some(stripe_fields.metadata(&["payment_intent_data", "metadata"])),
        ..StripeIntentState::default()
    };
    let payment_intent_id = read_payment_intent_id(&payment_change.payment);
    keep_stripe_object(
        &mut payment_change,
        StripeObjectKind::PaymentIntent,
        &payment_intent_id,
        &intent_state,
    )?;
    let session_state = StripeSessionState {
        client_reference_id: stripe_fields.text(&["client_reference_id"]),
        expires_at: stripe_fields
            .text(&["expires_at"])
            .and_then(|expires_at| expires_at.parse().ok()),
    };
    save_session(payment_change, &session_state).await
}

async fn load_session(
    stripe_call: &StripeCall<'_>,
    session_id: &str,
) -> Result<(PaymentDetail, StripeSessionState), StripeError> {
    let payment = find_stripe_payment(stripe_call, "checkout_session", session_id)
        .await?
        .ok_or_else(|| StripeError::resource_missing("checkout.session", session_id, "session"))?;
    let session_state = load_stripe_object(
        stripe_call.operation_context,
        StripeObjectKind::CheckoutSession,
        session_id,
    )
    .await?;
    Ok((payment, session_state))
}

pub async fn retrieve_checkout_session(
    stripe_call: &StripeCall<'_>,
    session_id: &str,
) -> StripeAnswer {
    let (payment, session_state) = load_session(stripe_call, session_id).await?;
    Ok(describe_checkout_session(&payment, &session_state))
}

pub async fn list_checkout_session_line_items(
    stripe_call: &StripeCall<'_>,
    session_id: &str,
) -> StripeAnswer {
    let (payment, _) = load_session(stripe_call, session_id).await?;
    Ok(describe_session_line_items(&payment))
}

/// Closes an open session's page unpaid, firing `checkout.session.expired`.
pub async fn expire_checkout_session(
    stripe_call: &StripeCall<'_>,
    session_id: &str,
) -> StripeAnswer {
    let (payment, session_state) = load_session(stripe_call, session_id).await?;
    if read_session_status(&payment) != "open" || payment.checkout_url.is_none() {
        return Err(StripeError::invalid_request(
            400,
            None,
            "Only Checkout Sessions with a status in [\"open\"] can be expired.",
        ));
    }
    let mut payment_change =
        PaymentChange::start(stripe_call.operation_context, payment, Vec::new()).await;
    payment_change.expire_checkout();
    save_session(payment_change, &session_state).await
}
