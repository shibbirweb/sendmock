use serde_json::{Value, json};

use super::stripe_payment_intent_object::{
    derive_related_id, describe_last_payment_error, read_created_seconds, read_payment_intent_id,
};
use crate::payments::{PaymentDetail, PaymentInstrument, PaymentStatus};

fn describe_card_details(payment: &PaymentDetail) -> Value {
    let Some(PaymentInstrument::Card {
        brand,
        last4,
        exp_month,
        exp_year,
    }) = &payment.method
    else {
        return Value::Null;
    };
    json!({
        "card": {
            "amount_authorized": payment.summary.amount_minor,
            "brand": brand,
            "checks": {"address_line1_check": null, "address_postal_code_check": null, "cvc_check": "pass"},
            "country": "US",
            "exp_month": exp_month,
            "exp_year": exp_year,
            "funding": "credit",
            "last4": last4,
            "network": brand,
            "three_d_secure": null,
            "wallet": null,
        },
        "type": "card",
    })
}

/// How the card network answered, as Stripe reports it on the charge.
fn describe_outcome(payment: &PaymentDetail, is_paid: bool) -> Value {
    if is_paid {
        return json!({
            "network_status": "approved_by_network",
            "reason": null,
            "risk_level": "normal",
            "risk_score": 32,
            "seller_message": "Payment complete.",
            "type": "authorized",
        });
    }
    json!({
        "network_status": "declined_by_network",
        "reason": payment.summary.failure_code,
        "risk_level": "normal",
        "risk_score": 32,
        "seller_message": "The bank did not return any further details with this decline.",
        "type": "issuer_declined",
    })
}

/// Settings a test charge never has, as Stripe answers them.
fn describe_charge_defaults() -> Value {
    json!({
        "object": "charge",
        "application": null,
        "application_fee": null,
        "application_fee_amount": null,
        "balance_transaction": null,
        "calculated_statement_descriptor": "SENDMOCK",
        "customer": null,
        "description": null,
        "failure_balance_transaction": null,
        "fraud_details": {},
        "livemode": false,
        "on_behalf_of": null,
        "receipt_number": null,
        "receipt_url": null,
        "review": null,
        "shipping": null,
        "source": null,
        "source_transfer": null,
        "statement_descriptor": null,
        "statement_descriptor_suffix": null,
        "transfer_data": null,
        "transfer_group": null,
    })
}

/// The payment as the Charge Stripe made for its PaymentIntent. Since API version 2022-11-15
/// Stripe leaves the `refunds` list out, so it is left out here too.
pub fn describe_charge(payment: &PaymentDetail) -> Value {
    let payment_intent_id = read_payment_intent_id(payment);
    let is_paid = payment.summary.status != PaymentStatus::Failed;
    let last_payment_error = describe_last_payment_error(payment);
    let charge_fields = json!({
        "id": derive_related_id(&payment_intent_id, "ch"),
        "amount": payment.summary.amount_minor,
        "amount_captured": payment.captured_minor,
        "amount_refunded": payment.summary.refunded_minor,
        "billing_details": {
            "address": {"city": null, "country": null, "line1": null, "line2": null, "postal_code": null, "state": null},
            "email": payment.summary.customer_email,
            "name": payment.summary.customer_name,
            "phone": null,
        },
        "captured": payment.captured_minor > 0,
        "created": read_created_seconds(payment),
        "currency": payment.summary.currency.to_ascii_lowercase(),
        "disputed": payment.dispute.is_some(),
        "failure_code": last_payment_error.get("code"),
        "failure_message": last_payment_error.get("message"),
        "metadata": payment.metadata,
        "outcome": describe_outcome(payment, is_paid),
        "paid": is_paid,
        "payment_intent": payment_intent_id,
        "payment_method": payment.method.is_some().then(|| derive_related_id(&payment_intent_id, "pm")),
        "payment_method_details": describe_card_details(payment),
        "receipt_email": payment.summary.customer_email,
        "refunded": payment.summary.status == PaymentStatus::Refunded,
        "status": if is_paid { "succeeded" } else { "failed" },
    });
    let mut charge = describe_charge_defaults();
    if let (Value::Object(charge_object), Value::Object(own_fields)) = (&mut charge, charge_fields)
    {
        charge_object.extend(own_fields);
    }
    charge
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::stripe::stripe_test_payments::build_paid_stripe_payment;

    #[test]
    fn a_partly_refunded_payment_is_a_captured_charge_with_the_refunded_amount() {
        let mut payment = build_paid_stripe_payment();
        payment.summary.status = PaymentStatus::PartiallyRefunded;
        payment.summary.refunded_minor = 500;

        let charge = describe_charge(&payment);

        assert_eq!(charge["id"], "ch_3PaidIntent");
        assert_eq!(charge["payment_intent"], "pi_3PaidIntent");
        assert_eq!(charge["amount_captured"], 2000);
        assert_eq!(charge["amount_refunded"], 500);
        assert_eq!(charge["captured"], true);
        assert_eq!(charge["refunded"], false);
        assert_eq!(charge["payment_method_details"]["card"]["last4"], "4242");
        assert!(charge.get("refunds").is_none());
    }

    #[test]
    fn a_fully_refunded_payment_is_a_refunded_charge() {
        let mut payment = build_paid_stripe_payment();
        payment.summary.status = PaymentStatus::Refunded;
        payment.summary.refunded_minor = 2000;

        let charge = describe_charge(&payment);

        assert_eq!(charge["refunded"], true);
        assert_eq!(charge["status"], "succeeded");
    }
}
