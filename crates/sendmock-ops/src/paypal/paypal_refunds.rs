use sendmock_core::format_rfc3339;
use serde_json::Value;

use super::paypal_amount::parse_amount;
use super::paypal_call::{PayPalAnswer, PayPalCall, PayPalReply};
use super::paypal_capture_object::{describe_capture, describe_refund};
use super::paypal_error::{PayPalApi, PayPalError};
use super::paypal_object_store::{
    CAPTURE_OBJECT_KIND, PayPalCaptureState, PayPalRefundState, REFUND_OBJECT_KIND,
    find_payment_object, load_paypal_objects, paypal_object_key,
};
use crate::payments::{
    PaymentChange, PaymentDetail, PaymentStatus, keep_provider_object, read_refundable_minor,
};

const PAYMENTS: PayPalApi = PayPalApi::Payments;

pub async fn retrieve_capture(paypal_call: &PayPalCall<'_>, capture_id: &str) -> PayPalAnswer {
    let (payment, capture_state): (PaymentDetail, PayPalCaptureState) =
        find_payment_object(paypal_call, CAPTURE_OBJECT_KIND, capture_id).await?;
    let paypal_objects = load_paypal_objects(paypal_call, &payment).await?;
    let body = describe_capture(
        &paypal_call.api_base_url(),
        &payment,
        &paypal_objects.order_state,
        (capture_id, &capture_state),
    );
    Ok(PayPalReply { status: 200, body })
}

/// What PayPal allows: a completed capture, not disputed, with enough left to refund.
fn check_refund(payment: &PaymentDetail, refund_minor: u64) -> Result<(), PayPalError> {
    let refusal = |issue: &str, description: &str| {
        Err(PayPalError::unprocessable(PAYMENTS, issue, description))
    };
    match payment.summary.status {
        PaymentStatus::Refunded => refusal(
            "CAPTURE_FULLY_REFUNDED",
            "The capture has already been fully refunded",
        ),
        PaymentStatus::Succeeded | PaymentStatus::PartiallyRefunded
            if refund_minor > read_refundable_minor(payment) =>
        {
            refusal(
                "REFUND_AMOUNT_EXCEEDED",
                "The refund amount must be less than or equal to the capture amount that has not yet been refunded.",
            )
        }
        PaymentStatus::Succeeded | PaymentStatus::PartiallyRefunded => Ok(()),
        _ => refusal("TRANSACTION_REFUSED", "The request was refused."),
    }
}

fn read_text(json_value: &Value, field_name: &str) -> Option<String> {
    json_value
        .get(field_name)
        .and_then(Value::as_str)
        .map(str::to_owned)
}

/// `POST /v2/payments/captures/{id}/refund`: `amount`, or all that is left.
pub async fn refund_capture(paypal_call: &PayPalCall<'_>, capture_id: &str) -> PayPalAnswer {
    let operation_context = paypal_call.operation_context;
    let refund_body = paypal_call.read_body(PAYMENTS)?;
    let (payment, capture_state): (PaymentDetail, PayPalCaptureState) =
        find_payment_object(paypal_call, CAPTURE_OBJECT_KIND, capture_id).await?;
    let refund_minor = match refund_body.get("amount") {
        Some(refund_amount) => parse_amount(refund_amount, "/amount", PAYMENTS)?.0,
        None => read_refundable_minor(&payment),
    };
    check_refund(&payment, refund_minor)?;
    let mut payment_change = PaymentChange::start(operation_context, payment, Vec::new()).await;
    payment_change.refund(refund_minor);
    let refund_id = paypal_call.generate_paypal_id();
    let refund_state = PayPalRefundState {
        capture_id: capture_id.to_owned(),
        amount_minor: refund_minor,
        currency: capture_state.currency,
        note_to_payer: read_text(refund_body, "note_to_payer"),
        invoice_id: read_text(refund_body, "invoice_id"),
        created_at: format_rfc3339(operation_context.clock.now_unix_ms()),
    };
    keep_provider_object(
        &mut payment_change,
        paypal_object_key(REFUND_OBJECT_KIND, &refund_id),
        &refund_state,
    )?;
    payment_change.save().await?;
    let body = describe_refund(
        &paypal_call.api_base_url(),
        (&refund_id, &refund_state),
        paypal_call.prefers_representation,
    );
    Ok(PayPalReply { status: 201, body })
}

pub async fn retrieve_refund(paypal_call: &PayPalCall<'_>, refund_id: &str) -> PayPalAnswer {
    let (_, refund_state): (PaymentDetail, PayPalRefundState) =
        find_payment_object(paypal_call, REFUND_OBJECT_KIND, refund_id).await?;
    let body = describe_refund(
        &paypal_call.api_base_url(),
        (refund_id, &refund_state),
        true,
    );
    Ok(PayPalReply { status: 200, body })
}
