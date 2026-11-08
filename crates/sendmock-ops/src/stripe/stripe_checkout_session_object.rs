use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use super::stripe_payment_intent_object::{read_created_seconds, read_payment_intent_id};
use crate::payments::{PaymentDetail, PaymentStatus};

/// How long Stripe keeps a Checkout Session open when `expires_at` is not sent.
pub const SESSION_LIFETIME_SECONDS: i64 = 24 * 60 * 60;

/// What Stripe keeps on a Checkout Session that a payment does not.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct StripeSessionState {
    #[serde(default)]
    pub client_reference_id: Option<String>,
    #[serde(default)]
    pub expires_at: Option<i64>,
}

pub fn read_session_id(payment: &PaymentDetail) -> String {
    payment
        .provider_ids
        .get("checkout_session")
        .cloned()
        .unwrap_or_default()
}

/// `open` until paid or expired: after a decline the customer may still pay, as on Stripe.
pub fn read_session_status(payment: &PaymentDetail) -> &'static str {
    match payment.summary.status {
        PaymentStatus::RequiresPayment | PaymentStatus::RequiresAction | PaymentStatus::Failed => {
            "open"
        }
        PaymentStatus::Canceled => "expired",
        PaymentStatus::Authorized
        | PaymentStatus::Succeeded
        | PaymentStatus::Refunded
        | PaymentStatus::PartiallyRefunded
        | PaymentStatus::Disputed => "complete",
    }
}

fn read_payment_status(payment: &PaymentDetail) -> &'static str {
    match payment.summary.status {
        PaymentStatus::Succeeded
        | PaymentStatus::Refunded
        | PaymentStatus::PartiallyRefunded
        | PaymentStatus::Disputed => "paid",
        _ => "unpaid",
    }
}

fn describe_customer_details(payment: &PaymentDetail) -> Value {
    if read_session_status(payment) != "complete" {
        return Value::Null;
    }
    json!({
        "address": null,
        "email": payment.summary.customer_email,
        "name": payment.summary.customer_name,
        "phone": null,
        "tax_exempt": "none",
        "tax_ids": [],
    })
}

/// Settings this emulation never turns on, as a new hosted session has them.
fn describe_session_defaults() -> Value {
    json!({
        "after_expiration": null,
        "allow_promotion_codes": null,
        "automatic_tax": {"enabled": false, "liability": null, "status": null},
        "billing_address_collection": null,
        "client_secret": null,
        "consent": null,
        "consent_collection": null,
        "custom_fields": [],
        "custom_text": {"after_submit": null, "shipping_address": null, "submit": null, "terms_of_service_acceptance": null},
        "customer": null,
        "customer_creation": "if_required",
        "invoice": null,
        "invoice_creation": {"enabled": false, "invoice_data": null},
        "livemode": false,
        "locale": null,
        "payment_link": null,
        "payment_method_collection": "if_required",
        "payment_method_options": {},
        "payment_method_types": ["card"],
        "phone_number_collection": {"enabled": false},
        "recovered_from": null,
        "setup_intent": null,
        "shipping_address_collection": null,
        "shipping_cost": null,
        "shipping_details": null,
        "shipping_options": [],
        "submit_type": null,
        "subscription": null,
        "total_details": {"amount_discount": 0, "amount_shipping": 0, "amount_tax": 0},
        "ui_mode": "hosted",
    })
}

/// The payment as Stripe's Checkout Session object in `payment` mode.
pub fn describe_checkout_session(
    payment: &PaymentDetail,
    session_state: &StripeSessionState,
) -> Value {
    let created_seconds = read_created_seconds(payment);
    let session_fields = json!({
        "id": read_session_id(payment),
        "object": "checkout.session",
        "amount_subtotal": payment.summary.amount_minor,
        "amount_total": payment.summary.amount_minor,
        "cancel_url": payment.cancel_url,
        "client_reference_id": session_state.client_reference_id,
        "created": created_seconds,
        "currency": payment.summary.currency.to_ascii_lowercase(),
        "customer_details": describe_customer_details(payment),
        "customer_email": payment.summary.customer_email,
        "expires_at": session_state.expires_at.unwrap_or(created_seconds + SESSION_LIFETIME_SECONDS),
        "metadata": payment.metadata,
        "mode": "payment",
        "payment_intent": payment.method.is_some().then(|| read_payment_intent_id(payment)),
        "payment_status": read_payment_status(payment),
        "status": read_session_status(payment),
        "success_url": payment.success_url,
        "url": payment.checkout_url,
    });
    let mut checkout_session = describe_session_defaults();
    if let (Value::Object(session_object), Value::Object(own_fields)) =
        (&mut checkout_session, session_fields)
    {
        session_object.extend(own_fields);
    }
    checkout_session
}

/// `GET /v1/checkout/sessions/{id}/line_items`: the session's items as a Stripe list.
pub fn describe_session_line_items(payment: &PaymentDetail) -> Value {
    let session_id = read_session_id(payment);
    let currency = payment.summary.currency.to_ascii_lowercase();
    let line_items: Vec<Value> = payment
        .line_items
        .iter()
        .enumerate()
        .map(|(item_index, line_item)| {
            let item_total = u64::from(line_item.quantity) * line_item.unit_amount_minor;
            let item_suffix = format!("{item_index}{}", payment.summary.id);
            json!({
                "id": format!("li_{item_suffix}"),
                "object": "item",
                "amount_discount": 0,
                "amount_subtotal": item_total,
                "amount_tax": 0,
                "amount_total": item_total,
                "currency": currency,
                "description": line_item.name,
                "price": {
                    "id": format!("price_{item_suffix}"),
                    "object": "price",
                    "active": false,
                    "currency": currency,
                    "livemode": false,
                    "product": format!("prod_{item_suffix}"),
                    "type": "one_time",
                    "unit_amount": line_item.unit_amount_minor,
                },
                "quantity": line_item.quantity,
            })
        })
        .collect();
    json!({
        "object": "list",
        "data": line_items,
        "has_more": false,
        "url": format!("/v1/checkout/sessions/{session_id}/line_items"),
    })
}
