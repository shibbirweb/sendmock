use sendmock_core::parse_rfc3339;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value, json};

use crate::payments::{PaymentDetail, PaymentStatus};

/// The order's receipt, kept apart from its notes.
pub const RECEIPT_METADATA_KEY: &str = "razorpay_receipt";
pub const REFUND_OBJECT_KIND: &str = "refund";

/// A refund as Razorpay keeps it, by its `rfnd_` id.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RazorpayRefund {
    pub payment_id: String,
    pub amount_minor: u64,
    pub notes: Map<String, Value>,
    pub receipt: Option<String>,
    pub created_at_unix_ms: i64,
}

pub fn read_unix_seconds(timestamp_text: &str) -> i64 {
    parse_rfc3339(timestamp_text)
        .unwrap_or_default()
        .div_euclid(1000)
}

pub fn read_order_id(payment: &PaymentDetail) -> &str {
    payment.provider_ids.get("order").map_or("", String::as_str)
}

pub fn read_payment_entity_id(payment: &PaymentDetail) -> &str {
    payment
        .provider_ids
        .get("payment")
        .map_or("", String::as_str)
}

fn read_notes(payment: &PaymentDetail) -> Map<String, Value> {
    payment
        .metadata
        .iter()
        .filter(|(note_name, _)| note_name.as_str() != RECEIPT_METADATA_KEY)
        .map(|(note_name, note_value)| (note_name.clone(), Value::from(note_value.clone())))
        .collect()
}

fn is_captured(payment: &PaymentDetail) -> bool {
    matches!(
        payment.summary.status,
        PaymentStatus::Succeeded
            | PaymentStatus::PartiallyRefunded
            | PaymentStatus::Refunded
            | PaymentStatus::Disputed
    )
}

/// Whether the customer tried to pay, so a payment entity exists.
pub fn has_payment_attempt(payment: &PaymentDetail) -> bool {
    !matches!(
        payment.summary.status,
        PaymentStatus::RequiresPayment | PaymentStatus::RequiresAction | PaymentStatus::Canceled
    )
}

pub fn describe_order(payment: &PaymentDetail) -> Value {
    let amount_paid = if is_captured(payment) {
        payment.summary.amount_minor
    } else {
        0
    };
    let order_status = if is_captured(payment) {
        "paid"
    } else if has_payment_attempt(payment) {
        "attempted"
    } else {
        "created"
    };
    json!({
        "id": read_order_id(payment),
        "entity": "order",
        "amount": payment.summary.amount_minor,
        "amount_paid": amount_paid,
        "amount_due": payment.summary.amount_minor - amount_paid,
        "currency": payment.summary.currency,
        "receipt": payment.metadata.get(RECEIPT_METADATA_KEY),
        "offer_id": null,
        "status": order_status,
        "attempts": u8::from(has_payment_attempt(payment)),
        "notes": read_notes(payment),
        "created_at": read_unix_seconds(&payment.summary.created_at),
    })
}

fn read_payment_status(payment: &PaymentDetail) -> &'static str {
    match payment.summary.status {
        PaymentStatus::Authorized => "authorized",
        PaymentStatus::Refunded => "refunded",
        PaymentStatus::Failed => "failed",
        _ => "captured",
    }
}

fn read_refund_status(payment: &PaymentDetail) -> Value {
    match payment.summary.status {
        PaymentStatus::Refunded => Value::from("full"),
        _ if payment.summary.refunded_minor > 0 => Value::from("partial"),
        _ => Value::Null,
    }
}

fn describe_payment_error(payment: &PaymentDetail) -> Value {
    let Some(failure_code) = payment.summary.failure_code.as_deref() else {
        return json!({
            "error_code": null, "error_description": null, "error_source": null,
            "error_step": null, "error_reason": null,
        });
    };
    json!({
        "error_code": "BAD_REQUEST_ERROR",
        "error_description": format!("Payment failed: {}", failure_code.replace('_', " ")),
        "error_source": "customer",
        "error_step": "payment_authorization",
        "error_reason": failure_code,
    })
}

/// The payment entity, once the customer tried to pay.
pub fn describe_payment(payment: &PaymentDetail) -> Value {
    let mut payment_entity = json!({
        "id": read_payment_entity_id(payment),
        "entity": "payment",
        "amount": payment.summary.amount_minor,
        "currency": payment.summary.currency,
        "status": read_payment_status(payment),
        "order_id": read_order_id(payment),
        "invoice_id": null,
        "international": false,
        "method": payment.method_key.as_deref().unwrap_or("card"),
        "amount_refunded": payment.summary.refunded_minor,
        "refund_status": read_refund_status(payment),
        "captured": is_captured(payment),
        "description": null,
        "card_id": null,
        "bank": null,
        "wallet": null,
        "vpa": null,
        "email": payment.summary.customer_email.as_deref().unwrap_or("void@razorpay.com"),
        "contact": payment.customer_phone.as_deref().unwrap_or("+919000090000"),
        "notes": read_notes(payment),
        "fee": 0,
        "tax": 0,
        "acquirer_data": {},
        "created_at": read_unix_seconds(&payment.summary.created_at),
    });
    if let (Some(entity_fields), Value::Object(error_fields)) = (
        payment_entity.as_object_mut(),
        describe_payment_error(payment),
    ) {
        entity_fields.extend(error_fields);
    }
    payment_entity
}

pub fn describe_refund(refund_id: &str, razorpay_refund: &RazorpayRefund, currency: &str) -> Value {
    json!({
        "id": refund_id,
        "entity": "refund",
        "amount": razorpay_refund.amount_minor,
        "currency": currency,
        "payment_id": razorpay_refund.payment_id,
        "notes": razorpay_refund.notes,
        "receipt": razorpay_refund.receipt,
        "acquirer_data": { "arn": null },
        "created_at": razorpay_refund.created_at_unix_ms.div_euclid(1000),
        "batch_id": null,
        "status": "processed",
        "speed_processed": "normal",
        "speed_requested": "normal",
    })
}

pub fn describe_collection(items: Vec<Value>) -> Value {
    json!({
        "entity": "collection",
        "count": items.len(),
        "items": items,
    })
}
