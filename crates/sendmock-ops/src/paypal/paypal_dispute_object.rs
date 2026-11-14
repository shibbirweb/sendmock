use serde_json::{Value, json};

use super::paypal_amount::describe_amount;
use crate::payments::PaymentDetail;

/// The payment's dispute reason in the words of PayPal's Customer Disputes API.
fn read_paypal_dispute_reason(dispute_reason: &str) -> &'static str {
    match dispute_reason {
        "fraudulent" => "UNAUTHORISED",
        "product_not_received" => "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
        "product_unacceptable" => "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
        "duplicate" => "DUPLICATE_TRANSACTION",
        "credit_not_processed" => "CREDIT_NOT_PROCESSED",
        "subscription_canceled" => "CANCELED_RECURRING_BILLING",
        _ => "OTHER",
    }
}

/// When the dispute was opened and last changed, from the timeline.
fn read_dispute_times(payment: &PaymentDetail) -> (String, String) {
    let read_time = |timeline_kind: &str| {
        payment
            .timeline
            .iter()
            .rev()
            .find(|timeline_event| timeline_event.kind == timeline_kind)
            .map(|timeline_event| timeline_event.created_at.clone())
    };
    let opened_at =
        read_time("dispute_opened").unwrap_or_else(|| payment.summary.created_at.clone());
    let updated_at = read_time("dispute_closed").unwrap_or_else(|| opened_at.clone());
    (opened_at, updated_at)
}

/// The payment's dispute as PayPal's Customer Disputes API describes it, naming the capture
/// it disputes; `None` while it has none.
pub fn describe_paypal_dispute(
    api_base_url: &str,
    payment: &PaymentDetail,
    capture_id: &str,
) -> Option<Value> {
    let payment_dispute = payment.dispute.as_ref()?;
    let dispute_id = format!("PP-D-{capture_id}");
    let (opened_at, updated_at) = read_dispute_times(payment);
    let currency = &payment.summary.currency;
    let paypal_status = match payment_dispute.status.as_str() {
        "needs_response" => "OPEN",
        "under_review" => "UNDER_REVIEW",
        _ => "RESOLVED",
    };
    let mut dispute = json!({
        "dispute_id": dispute_id,
        "create_time": opened_at,
        "update_time": updated_at,
        "disputed_transactions": [{
            "seller_transaction_id": capture_id,
            "seller": {"merchant_id": "SENDMOCKMERCHANT"},
        }],
        "reason": read_paypal_dispute_reason(&payment_dispute.reason),
        "status": paypal_status,
        "dispute_amount": describe_amount(payment.captured_minor, currency),
        "dispute_life_cycle_stage": "CHARGEBACK",
        "dispute_channel": "EXTERNAL",
        "links": [
            {"href": format!("{api_base_url}/v1/customer/disputes/{dispute_id}"), "rel": "self", "method": "GET"},
        ],
    });
    if paypal_status == "RESOLVED" {
        let is_won = payment_dispute.status == "won";
        dispute["dispute_outcome"] = json!({
            "outcome_code": if is_won { "RESOLVED_SELLER_FAVOUR" } else { "RESOLVED_BUYER_FAVOUR" },
            "amount_refunded": describe_amount(if is_won { 0 } else { payment.captured_minor }, currency),
        });
    }
    Some(dispute)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stripe_style_reasons_read_as_paypal_reasons() {
        assert_eq!(read_paypal_dispute_reason("fraudulent"), "UNAUTHORISED");
        assert_eq!(
            read_paypal_dispute_reason("product_not_received"),
            "MERCHANDISE_OR_SERVICE_NOT_RECEIVED"
        );
        assert_eq!(read_paypal_dispute_reason("general"), "OTHER");
    }
}
