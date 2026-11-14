use serde_json::{Value, json};

use super::paypal_amount::describe_amount;
use super::paypal_object_store::{
    PayPalCaptureState, PayPalOrderState, PayPalRefundState, read_order_id,
};
use crate::payments::{PaymentDetail, PaymentStatus};

/// A test fee shaped like PayPal's standard rate: 3.49% plus 49 minor units.
fn calculate_paypal_fee_minor(amount_minor: u64) -> u64 {
    (amount_minor * 349).div_ceil(10_000) + 49
}

fn read_capture_status(payment: &PaymentDetail) -> &'static str {
    match payment.summary.status {
        PaymentStatus::Failed => "DECLINED",
        PaymentStatus::Refunded => "REFUNDED",
        PaymentStatus::PartiallyRefunded => "PARTIALLY_REFUNDED",
        _ => "COMPLETED",
    }
}

/// The capture as PayPal's Payments API answers it.
pub fn describe_capture(
    api_base_url: &str,
    payment: &PaymentDetail,
    order_state: &PayPalOrderState,
    (capture_id, capture_state): (&str, &PayPalCaptureState),
) -> Value {
    let currency = &capture_state.currency;
    let fee_minor =
        calculate_paypal_fee_minor(capture_state.amount_minor).min(capture_state.amount_minor);
    json!({
        "id": capture_id,
        "status": read_capture_status(payment),
        "amount": describe_amount(capture_state.amount_minor, currency),
        "final_capture": true,
        "seller_protection": {
            "status": "ELIGIBLE",
            "dispute_categories": ["ITEM_NOT_RECEIVED", "UNAUTHORIZED_TRANSACTION"],
        },
        "seller_receivable_breakdown": {
            "gross_amount": describe_amount(capture_state.amount_minor, currency),
            "paypal_fee": describe_amount(fee_minor, currency),
            "net_amount": describe_amount(capture_state.amount_minor - fee_minor, currency),
        },
        "custom_id": order_state.custom_id,
        "invoice_id": order_state.invoice_id,
        "supplementary_data": {"related_ids": {"order_id": capture_state.order_id}},
        "links": [
            {"href": format!("{api_base_url}/v2/payments/captures/{capture_id}"), "rel": "self", "method": "GET"},
            {"href": format!("{api_base_url}/v2/payments/captures/{capture_id}/refund"), "rel": "refund", "method": "POST"},
            {"href": format!("{api_base_url}/v2/checkout/orders/{}", capture_state.order_id), "rel": "up", "method": "GET"},
        ],
        "create_time": capture_state.created_at,
        "update_time": capture_state.created_at,
    })
}

/// A PayPal id made from the payment's, for an object PayPal would have made but the payment
/// never asked the Orders API for: a checkout paid or declined on the page alone.
pub fn derive_paypal_id(payment: &PaymentDetail, id_prefix: char) -> String {
    let payment_id = payment.summary.id.to_ascii_uppercase();
    let id_suffix: String = payment_id
        .chars()
        .skip(payment_id.chars().count().saturating_sub(16))
        .collect();
    format!("{id_prefix}{id_suffix}")
}

/// The capture the payment stands for when no capture was kept for it.
pub fn derive_capture_state(payment: &PaymentDetail) -> (String, PayPalCaptureState) {
    let capture_state = PayPalCaptureState {
        order_id: read_order_id(payment),
        amount_minor: payment.summary.amount_minor,
        currency: payment.summary.currency.clone(),
        created_at: payment.summary.created_at.clone(),
    };
    (derive_paypal_id(payment, 'C'), capture_state)
}

fn describe_refund_links(api_base_url: &str, refund_id: &str, capture_id: &str) -> Value {
    json!([
        {"href": format!("{api_base_url}/v2/payments/refunds/{refund_id}"), "rel": "self", "method": "GET"},
        {"href": format!("{api_base_url}/v2/payments/captures/{capture_id}"), "rel": "up", "method": "GET"},
    ])
}

/// A refund as PayPal answers it: the whole refund, or with `return=minimal` its id, status
/// and links.
pub fn describe_refund(
    api_base_url: &str,
    (refund_id, refund_state): (&str, &PayPalRefundState),
    is_representation: bool,
) -> Value {
    let links = describe_refund_links(api_base_url, refund_id, &refund_state.capture_id);
    if !is_representation {
        return json!({"id": refund_id, "status": "COMPLETED", "links": links});
    }
    let currency = &refund_state.currency;
    json!({
        "id": refund_id,
        "amount": describe_amount(refund_state.amount_minor, currency),
        "seller_payable_breakdown": {
            "gross_amount": describe_amount(refund_state.amount_minor, currency),
            "paypal_fee": describe_amount(0, currency),
            "net_amount": describe_amount(refund_state.amount_minor, currency),
            "total_refunded_amount": describe_amount(refund_state.amount_minor, currency),
        },
        "invoice_id": refund_state.invoice_id,
        "note_to_payer": refund_state.note_to_payer,
        "status": "COMPLETED",
        "links": links,
        "create_time": refund_state.created_at,
        "update_time": refund_state.created_at,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_fee_is_three_point_four_nine_percent_plus_forty_nine() {
        assert_eq!(calculate_paypal_fee_minor(10_000), 398);
        assert_eq!(calculate_paypal_fee_minor(1), 50);
    }
}
