use sendmock_core::parse_rfc3339;
use serde_json::{Map, Value, json};

use super::stripe_payment_intent_object::{
    derive_related_id, read_created_seconds, read_payment_intent_id,
};
use crate::payments::PaymentDetail;

/// How long Stripe gives the merchant to answer a dispute.
const EVIDENCE_WINDOW_SECONDS: i64 = 7 * 24 * 60 * 60;

/// Every evidence field Stripe lists on a dispute; none is filled until the merchant answers.
pub const EVIDENCE_FIELD_NAMES: [&str; 27] = [
    "access_activity_log",
    "billing_address",
    "cancellation_policy",
    "cancellation_policy_disclosure",
    "cancellation_rebuttal",
    "customer_communication",
    "customer_email_address",
    "customer_name",
    "customer_purchase_ip",
    "customer_signature",
    "duplicate_charge_documentation",
    "duplicate_charge_explanation",
    "duplicate_charge_id",
    "product_description",
    "receipt",
    "refund_policy",
    "refund_policy_disclosure",
    "refund_refusal_explanation",
    "service_date",
    "service_documentation",
    "shipping_address",
    "shipping_carrier",
    "shipping_date",
    "shipping_documentation",
    "shipping_tracking_number",
    "uncategorized_file",
    "uncategorized_text",
];

/// When the dispute was opened, from the timeline; the payment's creation before that.
fn read_opened_seconds(payment: &PaymentDetail) -> i64 {
    payment
        .timeline
        .iter()
        .find(|timeline_event| timeline_event.kind == "dispute_opened")
        .and_then(|timeline_event| parse_rfc3339(&timeline_event.created_at))
        .map_or_else(
            || read_created_seconds(payment),
            |opened_ms| opened_ms / 1000,
        )
}

/// The payment's dispute as Stripe's Dispute object; `None` while it has none.
pub fn describe_dispute(payment: &PaymentDetail) -> Option<Value> {
    let payment_dispute = payment.dispute.as_ref()?;
    let payment_intent_id = read_payment_intent_id(payment);
    let opened_seconds = read_opened_seconds(payment);
    let mut evidence: Map<String, Value> = EVIDENCE_FIELD_NAMES
        .iter()
        .map(|field_name| ((*field_name).to_owned(), Value::Null))
        .collect();
    if let Some(evidence_text) = &payment_dispute.evidence {
        evidence.insert(
            "uncategorized_text".to_owned(),
            Value::from(evidence_text.clone()),
        );
    }
    let is_open = payment_dispute.status == "needs_response";
    Some(json!({
        "id": derive_related_id(&payment_intent_id, "dp"),
        "object": "dispute",
        "amount": payment.captured_minor,
        "balance_transactions": [],
        "charge": derive_related_id(&payment_intent_id, "ch"),
        "created": opened_seconds,
        "currency": payment.summary.currency.to_ascii_lowercase(),
        "evidence": evidence,
        "evidence_details": {
            "due_by": is_open.then_some(opened_seconds + EVIDENCE_WINDOW_SECONDS),
            "has_evidence": payment_dispute.evidence.is_some(),
            "past_due": false,
            "submission_count": u8::from(payment_dispute.evidence.is_some()),
        },
        "is_charge_refundable": false,
        "livemode": false,
        "metadata": {},
        "payment_intent": payment_intent_id,
        "reason": payment_dispute.reason,
        "status": payment_dispute.status,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::payments::{PaymentDispute, PaymentTimelineEvent};
    use crate::stripe::stripe_test_payments::build_paid_stripe_payment;

    #[test]
    fn an_open_dispute_needs_a_response_by_its_due_date() {
        let mut payment = build_paid_stripe_payment();
        payment.dispute = Some(PaymentDispute {
            status: "needs_response".to_owned(),
            reason: "fraudulent".to_owned(),
            evidence: None,
        });
        payment.timeline.push(PaymentTimelineEvent {
            kind: "dispute_opened".to_owned(),
            description: "Disputed".to_owned(),
            created_at: "2026-11-05T12:00:00Z".to_owned(),
        });

        let dispute = describe_dispute(&payment).unwrap_or_default();

        assert_eq!(dispute["id"], "dp_3PaidIntent");
        assert_eq!(dispute["charge"], "ch_3PaidIntent");
        assert_eq!(dispute["reason"], "fraudulent");
        assert_eq!(dispute["created"], 1_793_880_000);
        assert_eq!(
            dispute["evidence_details"]["due_by"],
            1_793_880_000 + EVIDENCE_WINDOW_SECONDS
        );
        assert!(dispute["evidence"]["uncategorized_text"].is_null());
    }

    #[test]
    fn a_closed_dispute_has_no_due_date_and_a_payment_without_one_has_no_dispute() {
        let mut payment = build_paid_stripe_payment();
        assert!(describe_dispute(&payment).is_none());
        payment.dispute = Some(PaymentDispute {
            status: "lost".to_owned(),
            reason: "fraudulent".to_owned(),
            evidence: None,
        });

        let dispute = describe_dispute(&payment).unwrap_or_default();

        assert_eq!(dispute["status"], "lost");
        assert!(dispute["evidence_details"]["due_by"].is_null());
    }
}
