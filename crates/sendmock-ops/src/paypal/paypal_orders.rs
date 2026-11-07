use sendmock_core::format_rfc3339;

use super::paypal_call::{PayPalAnswer, PayPalCall, PayPalReply};
use super::paypal_error::{PayPalApi, PayPalError};
use super::paypal_object_store::{
    CAPTURE_OBJECT_KIND, ORDER_OBJECT_KIND, PayPalCaptureState, find_order_payment,
    load_paypal_objects, paypal_object_key, read_order_id,
};
use super::paypal_order_object::{OrderAddresses, describe_minimal_order, describe_order};
use super::paypal_order_request::read_order_request;
use crate::payments::{
    PaymentChange, PaymentDetail, PaymentStatus, apply_checkout_outcome_profile,
    keep_provider_object, start_provider_payment,
};

const ORDERS: PayPalApi = PayPalApi::Orders;

/// The order as PayPal answers it after a change: the whole order.
async fn describe_saved_order(
    paypal_call: &PayPalCall<'_>,
    payment: &PaymentDetail,
) -> Result<serde_json::Value, PayPalError> {
    let paypal_objects = load_paypal_objects(paypal_call, payment).await?;
    let api_base_url = paypal_call.api_base_url();
    let addresses = OrderAddresses {
        api_base_url: &api_base_url,
        http_address: paypal_call.http_address(),
    };
    Ok(describe_order(&addresses, payment, &paypal_objects))
}

/// `POST /v2/checkout/orders`: a payment with this instance's checkout page as the approval
/// page. A decline there sends the payer back to `return_url`, as PayPal sends them back.
pub async fn create_order(paypal_call: &PayPalCall<'_>) -> PayPalAnswer {
    let operation_context = paypal_call.operation_context;
    let order_request = read_order_request(paypal_call.read_body(ORDERS)?)?;
    let return_url = order_request
        .payment_request
        .checkout
        .as_ref()
        .and_then(|checkout_urls| checkout_urls.success_url.clone());
    let mut payment_change =
        start_provider_payment(operation_context, order_request.payment_request).await?;
    payment_change.payment.fail_url = return_url;
    apply_checkout_outcome_profile(&mut payment_change, operation_context).await?;
    let order_id = read_order_id(&payment_change.payment);
    let order_state = order_request.order_state;
    keep_provider_object(
        &mut payment_change,
        paypal_object_key(ORDER_OBJECT_KIND, &order_id),
        &order_state,
    )?;
    let payment = payment_change.save().await?;
    let body = if paypal_call.prefers_representation {
        describe_saved_order(paypal_call, &payment).await?
    } else {
        let api_base_url = paypal_call.api_base_url();
        let addresses = OrderAddresses {
            api_base_url: &api_base_url,
            http_address: paypal_call.http_address(),
        };
        describe_minimal_order(&addresses, &payment, order_state.has_payment_source)
    };
    Ok(PayPalReply { status: 201, body })
}

pub async fn retrieve_order(paypal_call: &PayPalCall<'_>, order_id: &str) -> PayPalAnswer {
    let payment = find_order_payment(paypal_call, order_id).await?;
    Ok(PayPalReply {
        status: 200,
        body: describe_saved_order(paypal_call, &payment).await?,
    })
}

/// Only an approved order is captured, once; a decline on the page shows here.
fn check_capturable(payment: &PaymentDetail) -> Result<(), PayPalError> {
    let refusal = |issue: &str, description: &str| {
        Err(PayPalError::unprocessable(ORDERS, issue, description))
    };
    match payment.summary.status {
        PaymentStatus::Authorized => Ok(()),
        PaymentStatus::RequiresPayment | PaymentStatus::RequiresAction => refusal(
            "ORDER_NOT_APPROVED",
            "Payer has not yet approved the Order for payment. Please redirect the payer to the 'rel':'approve' url returned as part of the HATEOAS links within the Create Order call or provide a valid payment_source in the request.",
        ),
        PaymentStatus::Failed => refusal(
            "INSTRUMENT_DECLINED",
            "The instrument presented  was either declined by the processor or bank, or it can't be used for this payment.",
        ),
        PaymentStatus::Canceled => refusal("ORDER_EXPIRED", "The order has expired."),
        PaymentStatus::Succeeded
        | PaymentStatus::Refunded
        | PaymentStatus::PartiallyRefunded
        | PaymentStatus::Disputed => refusal(
            "ORDER_ALREADY_CAPTURED",
            "Order already captured.If 'intent=CAPTURE' only one capture per order is allowed.",
        ),
    }
}

/// `POST /v2/checkout/orders/{id}/capture`: the whole amount, as one final capture.
pub async fn capture_order(paypal_call: &PayPalCall<'_>, order_id: &str) -> PayPalAnswer {
    let operation_context = paypal_call.operation_context;
    let payment = find_order_payment(paypal_call, order_id).await?;
    check_capturable(&payment)?;
    let mut payment_change = PaymentChange::start(operation_context, payment, Vec::new()).await;
    let amount_minor = payment_change.payment.summary.amount_minor;
    payment_change.capture(amount_minor);
    let capture_id = paypal_call.generate_paypal_id();
    let capture_state = PayPalCaptureState {
        order_id: order_id.to_owned(),
        amount_minor,
        currency: payment_change.payment.summary.currency.clone(),
        created_at: format_rfc3339(operation_context.clock.now_unix_ms()),
    };
    keep_provider_object(
        &mut payment_change,
        paypal_object_key(CAPTURE_OBJECT_KIND, &capture_id),
        &capture_state,
    )?;
    let payment = payment_change.save().await?;
    Ok(PayPalReply {
        status: 201,
        body: describe_saved_order(paypal_call, &payment).await?,
    })
}
