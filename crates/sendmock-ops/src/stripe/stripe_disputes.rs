use serde_json::Value;

use super::stripe_call::{StripeAnswer, StripeCall};
use super::stripe_dispute_object::{EVIDENCE_FIELD_NAMES, describe_dispute};
use super::stripe_error::StripeError;
use super::stripe_intent_lookup::find_stripe_payment;
use crate::payments::{DisputeOutcome, PaymentChange, PaymentDetail};

/// A dispute's payment: its id is the PaymentIntent's with `dp_` for `pi_`.
async fn find_disputed_payment(
    stripe_call: &StripeCall<'_>,
    dispute_id: &str,
) -> Result<PaymentDetail, StripeError> {
    let payment_intent_id = format!(
        "pi_{}",
        dispute_id.strip_prefix("dp_").unwrap_or(dispute_id)
    );
    find_stripe_payment(stripe_call, "payment_intent", &payment_intent_id)
        .await?
        .filter(|payment| payment.dispute.is_some())
        .ok_or_else(|| StripeError::resource_missing("dispute", dispute_id, "dispute"))
}

fn describe_found_dispute(payment: &PaymentDetail, dispute_id: &str) -> StripeAnswer {
    describe_dispute(payment)
        .ok_or_else(|| StripeError::resource_missing("dispute", dispute_id, "dispute"))
}

fn is_answerable(payment: &PaymentDetail) -> bool {
    payment
        .dispute
        .as_ref()
        .is_some_and(|dispute| dispute.status == "needs_response")
}

/// `GET /v1/disputes/{disputeId}`.
pub async fn retrieve_dispute(stripe_call: &StripeCall<'_>, dispute_id: &str) -> StripeAnswer {
    let payment = find_disputed_payment(stripe_call, dispute_id).await?;
    describe_found_dispute(&payment, dispute_id)
}

/// The evidence fields sent, as one text, in Stripe's field order.
fn read_evidence_text(stripe_call: &StripeCall<'_>) -> String {
    EVIDENCE_FIELD_NAMES
        .iter()
        .filter_map(|field_name| stripe_call.stripe_fields.text(&["evidence", field_name]))
        .collect::<Vec<_>>()
        .join("\n")
}

/// `POST /v1/disputes/{disputeId}`: evidence, submitted unless `submit=false`, puts the
/// dispute under review and fires `charge.dispute.updated`.
pub async fn update_dispute(stripe_call: &StripeCall<'_>, dispute_id: &str) -> StripeAnswer {
    let payment = find_disputed_payment(stripe_call, dispute_id).await?;
    if !is_answerable(&payment) {
        return Err(StripeError::invalid_request(
            400,
            None,
            "This dispute is already closed or its evidence was already submitted.",
        ));
    }
    let is_submitted = stripe_call
        .stripe_fields
        .find(&["submit"])
        .and_then(Value::as_str)
        != Some("false");
    if !is_submitted {
        return describe_found_dispute(&payment, dispute_id);
    }
    let evidence_text = read_evidence_text(stripe_call);
    let mut payment_change =
        PaymentChange::start(stripe_call.operation_context, payment, Vec::new()).await;
    payment_change.answer_dispute(if evidence_text.is_empty() {
        "Evidence submitted"
    } else {
        &evidence_text
    });
    let payment = payment_change.save().await?;
    describe_found_dispute(&payment, dispute_id)
}

/// `POST /v1/disputes/{disputeId}/close`: the merchant accepts the dispute, so it is lost.
pub async fn close_dispute(stripe_call: &StripeCall<'_>, dispute_id: &str) -> StripeAnswer {
    let payment = find_disputed_payment(stripe_call, dispute_id).await?;
    if !is_answerable(&payment) {
        return Err(StripeError::invalid_request(
            400,
            None,
            "This dispute can no longer be closed.",
        ));
    }
    let mut payment_change =
        PaymentChange::start(stripe_call.operation_context, payment, Vec::new()).await;
    payment_change.resolve_dispute(DisputeOutcome::Lost);
    let payment = payment_change.save().await?;
    describe_found_dispute(&payment, dispute_id)
}
