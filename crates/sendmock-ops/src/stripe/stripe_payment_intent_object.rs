use std::collections::BTreeMap;

use sendmock_core::parse_rfc3339;
use sendmock_payments::describe_stripe_card_decline;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use crate::payments::{PaymentCaptureMethod, PaymentDetail, PaymentInstrument, PaymentStatus};

/// What Stripe keeps on a PaymentIntent that a payment does not: the PaymentMethod attached
/// before confirming, and how it was canceled.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct StripeIntentState {
    /// As the app named it, e.g. `pm_card_visa`; cleared when a confirm is declined.
    #[serde(default)]
    pub payment_method: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    /// The PaymentIntent's own metadata; the payment's when none was sent.
    #[serde(default)]
    pub metadata: Option<BTreeMap<String, String>>,
    #[serde(default)]
    pub cancellation_reason: Option<String>,
    #[serde(default)]
    pub canceled_at: Option<i64>,
    #[serde(default)]
    pub return_url: Option<String>,
}

pub fn read_payment_intent_id(payment: &PaymentDetail) -> String {
    payment
        .provider_ids
        .get("payment_intent")
        .cloned()
        .unwrap_or_else(|| format!("pi_{}", payment.summary.id))
}

/// The id Stripe gives the intent's charge (`ch_`) or PaymentMethod (`pm_`).
pub fn derive_related_id(payment_intent_id: &str, id_prefix: &str) -> String {
    let id_suffix = payment_intent_id
        .strip_prefix("pi_")
        .unwrap_or(payment_intent_id);
    format!("{id_prefix}_{id_suffix}")
}

pub fn read_created_seconds(payment: &PaymentDetail) -> i64 {
    parse_rfc3339(&payment.summary.created_at).unwrap_or_default() / 1000
}

pub fn read_intent_status(
    payment: &PaymentDetail,
    intent_state: &StripeIntentState,
) -> &'static str {
    match payment.summary.status {
        PaymentStatus::RequiresPayment if intent_state.payment_method.is_some() => {
            "requires_confirmation"
        }
        PaymentStatus::RequiresPayment | PaymentStatus::Failed => "requires_payment_method",
        PaymentStatus::RequiresAction => "requires_action",
        PaymentStatus::Authorized => "requires_capture",
        PaymentStatus::Canceled => "canceled",
        PaymentStatus::Succeeded
        | PaymentStatus::Refunded
        | PaymentStatus::PartiallyRefunded
        | PaymentStatus::Disputed => "succeeded",
    }
}

/// The card a payment was paid with as a Stripe PaymentMethod; `None` before a card is used.
pub fn describe_payment_method(payment: &PaymentDetail, payment_method_id: &str) -> Option<Value> {
    let Some(PaymentInstrument::Card {
        brand,
        last4,
        exp_month,
        exp_year,
    }) = &payment.method
    else {
        return None;
    };
    Some(json!({
        "id": payment_method_id,
        "object": "payment_method",
        "billing_details": {
            "address": {"city": null, "country": null, "line1": null, "line2": null, "postal_code": null, "state": null},
            "email": null,
            "name": null,
            "phone": null,
        },
        "card": {
            "brand": brand,
            "checks": {"address_line1_check": null, "address_postal_code_check": null, "cvc_check": "pass"},
            "country": "US",
            "exp_month": exp_month,
            "exp_year": exp_year,
            "funding": "credit",
            "last4": last4,
            "networks": {"available": [brand], "preferred": null},
            "three_d_secure_usage": {"supported": true},
            "wallet": null,
        },
        "created": read_created_seconds(payment),
        "customer": null,
        "livemode": false,
        "metadata": {},
        "type": "card",
    }))
}

/// Why the last confirm failed, as Stripe reports it on the PaymentIntent.
pub fn describe_last_payment_error(payment: &PaymentDetail) -> Value {
    let Some(decline_reason) = payment
        .summary
        .failure_code
        .as_deref()
        .filter(|_| payment.summary.status == PaymentStatus::Failed)
    else {
        return Value::Null;
    };
    let card_decline = describe_stripe_card_decline(decline_reason);
    let payment_intent_id = read_payment_intent_id(payment);
    let is_authentication_failure = decline_reason == "authentication_failed";
    json!({
        "charge": (!is_authentication_failure).then(|| derive_related_id(&payment_intent_id, "ch")),
        "code": card_decline.code,
        "decline_code": card_decline.decline_code,
        "doc_url": format!("https://stripe.com/docs/error-codes/{}", card_decline.code.replace('_', "-")),
        "message": card_decline.message,
        "payment_method": describe_payment_method(payment, &derive_related_id(&payment_intent_id, "pm")),
        "type": if is_authentication_failure { "invalid_request_error" } else { "card_error" },
    })
}

fn describe_next_action(
    payment: &PaymentDetail,
    intent_state: &StripeIntentState,
    http_address: &str,
) -> Value {
    if payment.summary.status != PaymentStatus::RequiresAction {
        return Value::Null;
    }
    json!({
        "type": "redirect_to_url",
        "redirect_to_url": {
            "return_url": intent_state.return_url,
            "url": format!("http://{http_address}/pay/{}", payment.summary.id),
        },
    })
}

/// The payment as Stripe's PaymentIntent object.
pub fn describe_payment_intent(
    payment: &PaymentDetail,
    intent_state: &StripeIntentState,
    http_address: &str,
) -> Value {
    let payment_intent_id = read_payment_intent_id(payment);
    let intent_status = read_intent_status(payment, intent_state);
    let has_card = payment.method.is_some() && intent_status != "requires_payment_method";
    let is_attached = has_card || intent_state.payment_method.is_some();
    json!({
        "id": payment_intent_id,
        "object": "payment_intent",
        "amount": payment.summary.amount_minor,
        "amount_capturable": if intent_status == "requires_capture" { payment.summary.amount_minor } else { 0 },
        "amount_details": {"tip": {}},
        "amount_received": payment.captured_minor,
        "application": null,
        "application_fee_amount": null,
        "automatic_payment_methods": null,
        "canceled_at": intent_state.canceled_at,
        "cancellation_reason": intent_state.cancellation_reason,
        "capture_method": match payment.capture_method {
            PaymentCaptureMethod::Automatic => "automatic",
            PaymentCaptureMethod::Manual => "manual",
        },
        "client_secret": format!("{payment_intent_id}_secret_{}", payment.summary.id),
        "confirmation_method": "automatic",
        "created": read_created_seconds(payment),
        "currency": payment.summary.currency.to_ascii_lowercase(),
        "customer": null,
        "description": intent_state.description,
        "last_payment_error": describe_last_payment_error(payment),
        "latest_charge": payment.method.is_some().then(|| derive_related_id(&payment_intent_id, "ch")),
        "livemode": false,
        "metadata": intent_state.metadata.as_ref().unwrap_or(&payment.metadata),
        "next_action": describe_next_action(payment, intent_state, http_address),
        "on_behalf_of": null,
        "payment_method": is_attached.then(|| derive_related_id(&payment_intent_id, "pm")),
        "payment_method_options": {"card": {"installments": null, "mandate_options": null, "network": null, "request_three_d_secure": "automatic"}},
        "payment_method_types": ["card"],
        "processing": null,
        "receipt_email": payment.summary.customer_email,
        "review": null,
        "setup_future_usage": null,
        "shipping": null,
        "source": null,
        "statement_descriptor": null,
        "statement_descriptor_suffix": null,
        "status": intent_status,
        "transfer_data": null,
        "transfer_group": null,
    })
}
