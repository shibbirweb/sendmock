use std::collections::BTreeMap;

use sendmock_payments::format_major_amount;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use super::stripe_call::{StripeAnswer, StripeCall};
use super::stripe_error::StripeError;
use super::stripe_intent_lookup::load_payment_intent;
use super::stripe_object_store::{StripeObjectKind, find_stripe_object, save_stripe_object};
use super::stripe_payment_intent_object::{derive_related_id, read_payment_intent_id};
use crate::payments::{PaymentDetail, PaymentStatus, read_refundable_minor};

const REFUND_REASONS: [&str; 3] = ["duplicate", "fraudulent", "requested_by_customer"];

/// A Stripe refund as kept beside its payment.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StripeRefundState {
    pub amount: u64,
    pub currency: String,
    pub payment_intent: String,
    pub reason: Option<String>,
    pub metadata: BTreeMap<String, String>,
    pub created: i64,
}

fn describe_refund(refund_id: &str, refund_state: &StripeRefundState) -> Value {
    json!({
        "id": refund_id,
        "object": "refund",
        "amount": refund_state.amount,
        "balance_transaction": null,
        "charge": derive_related_id(&refund_state.payment_intent, "ch"),
        "created": refund_state.created,
        "currency": refund_state.currency,
        "metadata": refund_state.metadata,
        "payment_intent": refund_state.payment_intent,
        "reason": refund_state.reason,
        "receipt_number": null,
        "source_transfer_reversal": null,
        "status": "succeeded",
        "transfer_reversal": null,
    })
}

/// `payment_intent`, or the `ch_` charge Stripe made for it.
fn read_refunded_intent_id(stripe_call: &StripeCall<'_>) -> Result<String, StripeError> {
    let stripe_fields = &stripe_call.stripe_fields;
    stripe_fields
        .text(&["payment_intent"])
        .or_else(|| {
            stripe_fields
                .text(&["charge"])
                .map(|charge_id| format!("pi_{}", charge_id.strip_prefix("ch_").unwrap_or(&charge_id)))
        })
        .ok_or_else(|| {
            StripeError::invalid_request(
                400,
                Some("parameter_missing"),
                "One of the following params should be provided for this request: payment_intent or charge.",
            )
        })
}

fn format_money(amount_minor: u64, currency: &str) -> String {
    format!("{} {currency}", format_major_amount(amount_minor, currency))
}

/// What Stripe allows: a paid charge, not disputed, with something left to refund.
fn check_refund(payment: &PaymentDetail, refund_minor: u64) -> Result<(), StripeError> {
    let charge_id = derive_related_id(&read_payment_intent_id(payment), "ch");
    let refundable_minor = read_refundable_minor(payment);
    match payment.summary.status {
        PaymentStatus::Disputed => Err(StripeError::invalid_request(
            400,
            Some("charge_disputed"),
            format!("Charge {charge_id} has been charged back; cannot issue a refund."),
        )),
        PaymentStatus::Refunded => Err(StripeError::invalid_request(
            400,
            Some("charge_already_refunded"),
            format!("Charge {charge_id} has already been refunded."),
        )),
        PaymentStatus::Succeeded | PaymentStatus::PartiallyRefunded
            if refund_minor > refundable_minor =>
        {
            let currency = &payment.summary.currency;
            Err(StripeError::invalid_request(
                400,
                Some("amount_too_large"),
                format!(
                    "Refund amount ({}) is greater than unrefunded amount on charge ({})",
                    format_money(refund_minor, currency),
                    format_money(refundable_minor, currency)
                ),
            )
            .with_param("amount"))
        }
        PaymentStatus::Succeeded | PaymentStatus::PartiallyRefunded => Ok(()),
        _ => Err(StripeError::invalid_request(
            400,
            None,
            "This PaymentIntent does not have a successful charge to refund.",
        )
        .with_param("payment_intent")),
    }
}

/// `POST /v1/refunds`: refunds all that is left, or `amount`, firing `charge.refunded`.
pub async fn create_refund(stripe_call: &StripeCall<'_>) -> StripeAnswer {
    let stripe_fields = &stripe_call.stripe_fields;
    let payment_intent_id = read_refunded_intent_id(stripe_call)?;
    let reason = stripe_fields.text(&["reason"]);
    if reason
        .as_deref()
        .is_some_and(|reason| !REFUND_REASONS.contains(&reason))
    {
        return Err(StripeError::invalid_value(
            "reason",
            "Invalid reason: must be one of duplicate, fraudulent, or requested_by_customer",
        ));
    }
    let (mut payment_change, _) = load_payment_intent(stripe_call, &payment_intent_id).await?;
    let refund_minor = stripe_fields
        .positive_amount(&["amount"])?
        .unwrap_or_else(|| read_refundable_minor(&payment_change.payment));
    check_refund(&payment_change.payment, refund_minor)?;
    payment_change.refund(refund_minor);
    let payment = payment_change.save().await?;
    let refund_id = format!(
        "re_{}",
        stripe_call.operation_context.id_generator.generate_id()
    );
    let refund_state = StripeRefundState {
        amount: refund_minor,
        currency: payment.summary.currency.to_ascii_lowercase(),
        payment_intent: payment_intent_id,
        reason,
        metadata: stripe_fields.metadata(&["metadata"]),
        created: stripe_call.now_seconds(),
    };
    save_stripe_object(
        stripe_call.operation_context,
        StripeObjectKind::Refund,
        &refund_id,
        &payment.summary.id,
        &refund_state,
    )
    .await?;
    Ok(describe_refund(&refund_id, &refund_state))
}

pub async fn retrieve_refund(stripe_call: &StripeCall<'_>, refund_id: &str) -> StripeAnswer {
    let (_, refund_state) = find_stripe_object::<StripeRefundState>(
        stripe_call.operation_context,
        StripeObjectKind::Refund,
        refund_id,
    )
    .await?
    .ok_or_else(|| StripeError::resource_missing("refund", refund_id, "id"))?;
    Ok(describe_refund(refund_id, &refund_state))
}
