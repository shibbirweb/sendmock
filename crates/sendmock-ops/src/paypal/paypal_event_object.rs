use sendmock_store::PaymentProviderObjectRecord;
use serde_json::Value;

use super::paypal_call::build_paypal_api_base_url;
use super::paypal_capture_object::{
    derive_capture_state, derive_paypal_id, describe_capture, describe_refund,
};
use super::paypal_dispute_object::describe_paypal_dispute;
use super::paypal_object_store::{
    PayPalCaptureState, PayPalPaymentObjects, PayPalRefundState, load_kept_paypal_objects,
};
use super::paypal_order_object::{OrderAddresses, describe_order};
use crate::payments::PaymentDetail;
use crate::{OperationContext, OperationError};

/// The newest capture, or the one the payment stands for when the Orders API made none.
fn read_newest_capture(
    payment: &PaymentDetail,
    paypal_objects: &PayPalPaymentObjects,
) -> (String, PayPalCaptureState) {
    paypal_objects
        .captures
        .last()
        .cloned()
        .unwrap_or_else(|| derive_capture_state(payment))
}

/// The newest refund, or one for all that was refunded when the Orders API made none.
fn read_newest_refund(
    payment: &PaymentDetail,
    paypal_objects: &PayPalPaymentObjects,
) -> (String, PayPalRefundState) {
    if let Some(newest_refund) = paypal_objects.refunds.last() {
        return newest_refund.clone();
    }
    let (capture_id, capture_state) = read_newest_capture(payment, paypal_objects);
    let refund_state = PayPalRefundState {
        capture_id,
        amount_minor: payment.summary.refunded_minor,
        currency: capture_state.currency,
        note_to_payer: None,
        invoice_id: None,
        created_at: payment
            .timeline
            .iter()
            .rev()
            .find(|timeline_event| timeline_event.kind == "refunded")
            .map_or_else(
                || payment.summary.created_at.clone(),
                |timeline_event| timeline_event.created_at.clone(),
            ),
    };
    (derive_paypal_id(payment, 'R'), refund_state)
}

/// The resource a PayPal webhook event is about, chosen by the event's name and built as the
/// API answers it, so a webhook and a retrieve never disagree; `null` for a name PayPal does
/// not send.
pub async fn describe_paypal_event_object(
    operation_context: &OperationContext,
    payment: &PaymentDetail,
    event_name: &str,
    kept_provider_objects: &[PaymentProviderObjectRecord],
) -> Result<Value, OperationError> {
    let paypal_objects =
        load_kept_paypal_objects(operation_context, payment, kept_provider_objects).await?;
    let http_address = &operation_context.instance_details.http_address;
    let api_base_url = build_paypal_api_base_url(http_address);
    if event_name.starts_with("CHECKOUT.ORDER.") {
        let addresses = OrderAddresses {
            api_base_url: &api_base_url,
            http_address,
        };
        return Ok(describe_order(&addresses, payment, &paypal_objects));
    }
    if event_name == "PAYMENT.CAPTURE.REFUNDED" {
        let (refund_id, refund_state) = read_newest_refund(payment, &paypal_objects);
        return Ok(describe_refund(
            &api_base_url,
            (&refund_id, &refund_state),
            true,
        ));
    }
    let (capture_id, capture_state) = read_newest_capture(payment, &paypal_objects);
    if event_name.starts_with("PAYMENT.CAPTURE.") {
        return Ok(describe_capture(
            &api_base_url,
            payment,
            &paypal_objects.order_state,
            (&capture_id, &capture_state),
        ));
    }
    if event_name.starts_with("CUSTOMER.DISPUTE.") {
        return Ok(describe_paypal_dispute(&api_base_url, payment, &capture_id).unwrap_or_default());
    }
    Ok(Value::Null)
}
