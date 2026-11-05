use std::collections::BTreeMap;

use sendmock_payments::is_currency_code;
use serde_json::Value;

use super::razorpay_call::{RAZORPAY_PROVIDER_KEY, RazorpayCall};
use super::razorpay_entities::{
    RECEIPT_METADATA_KEY, describe_collection, describe_order, describe_payment,
    has_payment_attempt,
};
use super::razorpay_error::{RazorpayAnswer, RazorpayError};
use crate::OperationError;
use crate::payments::{
    PaymentCaptureMethod, ProviderCheckoutUrls, ProviderPaymentRequest,
    apply_checkout_outcome_profile, start_provider_payment,
};

/// Razorpay's smallest order: one unit of the currency (100 paise).
const SMALLEST_AMOUNT_MINOR: u64 = 100;
/// Checkout's `callback_url` lives in the browser, so the order's notes carry it to SendMock.
const CALLBACK_URL_NOTE: &str = "callback_url";

fn read_notes(razorpay_call: &RazorpayCall<'_>) -> BTreeMap<String, String> {
    let Some(Value::Object(notes)) = razorpay_call.read_field("notes") else {
        return BTreeMap::new();
    };
    notes
        .iter()
        .map(|(note_name, note_value)| {
            let note_text = note_value
                .as_str()
                .map_or_else(|| note_value.to_string(), str::to_owned);
            (note_name.clone(), note_text)
        })
        .collect()
}

/// `payment_capture` `0` or `false` leaves payments authorized until the app captures them.
fn read_capture_method(razorpay_call: &RazorpayCall<'_>) -> PaymentCaptureMethod {
    let is_manual = match razorpay_call.read_field("payment_capture") {
        Some(Value::Bool(is_automatic)) => !is_automatic,
        Some(_) => razorpay_call.read_whole_number("payment_capture") == Some(0),
        None => false,
    };
    if is_manual {
        PaymentCaptureMethod::Manual
    } else {
        PaymentCaptureMethod::Automatic
    }
}

fn check_order_fields(razorpay_call: &RazorpayCall<'_>) -> Result<(u64, String), RazorpayError> {
    let currency = razorpay_call
        .read_text("currency")
        .unwrap_or_default()
        .to_ascii_uppercase();
    if !is_currency_code(&currency) {
        return Err(RazorpayError::invalid_field(
            "currency",
            "The currency field is required.",
        ));
    }
    match razorpay_call.read_whole_number("amount") {
        Some(amount_minor) if amount_minor >= SMALLEST_AMOUNT_MINOR => Ok((amount_minor, currency)),
        Some(_) => Err(RazorpayError::invalid_field(
            "amount",
            format!("The amount must be atleast {currency} 1.00"),
        )),
        None => Err(RazorpayError::invalid_field(
            "amount",
            "The amount field is required.",
        )),
    }
}

fn build_payment_request(
    razorpay_call: &RazorpayCall<'_>,
    amount_minor: u64,
    currency: String,
) -> ProviderPaymentRequest {
    let notes = read_notes(razorpay_call);
    let callback_url = notes.get(CALLBACK_URL_NOTE).cloned();
    let mut metadata = notes;
    if let Some(receipt) = razorpay_call.read_text("receipt") {
        metadata.insert(RECEIPT_METADATA_KEY.to_owned(), receipt);
    }
    ProviderPaymentRequest {
        provider: RAZORPAY_PROVIDER_KEY.to_owned(),
        amount_minor,
        currency,
        customer_email: metadata.get("email").cloned(),
        line_items: Vec::new(),
        metadata,
        capture_method: read_capture_method(razorpay_call),
        checkout: Some(ProviderCheckoutUrls {
            success_url: callback_url.clone(),
            cancel_url: callback_url,
        }),
    }
}

/// `POST /v1/orders`: an order the checkout page pays; `notes.callback_url` is where the
/// page posts the result.
pub async fn create_order(
    razorpay_call: &RazorpayCall<'_>,
) -> Result<RazorpayAnswer, OperationError> {
    let (amount_minor, currency) = match check_order_fields(razorpay_call) {
        Ok(checked_fields) => checked_fields,
        Err(razorpay_error) => return Ok(Err(razorpay_error)),
    };
    let operation_context = razorpay_call.operation_context;
    let payment_request = build_payment_request(razorpay_call, amount_minor, currency);
    let callback_url = payment_request
        .checkout
        .as_ref()
        .and_then(|checkout_urls| checkout_urls.success_url.clone());
    let mut payment_change = start_provider_payment(operation_context, payment_request).await?;
    payment_change.payment.fail_url = callback_url;
    apply_checkout_outcome_profile(&mut payment_change, operation_context).await?;
    let payment = payment_change.save().await?;
    Ok(Ok((200, describe_order(&payment))))
}

/// `GET /v1/orders/{orderId}`, and with `payments`, the order's payments.
pub async fn fetch_order(
    razorpay_call: &RazorpayCall<'_>,
    order_id: &str,
    is_payment_list: bool,
) -> Result<RazorpayAnswer, OperationError> {
    let Some(payment) = razorpay_call.find_payment("order", order_id).await? else {
        return Ok(Err(RazorpayError::missing_id()));
    };
    if !is_payment_list {
        return Ok(Ok((200, describe_order(&payment))));
    }
    let order_payments = if has_payment_attempt(&payment) {
        vec![describe_payment(&payment)]
    } else {
        Vec::new()
    };
    Ok(Ok((200, describe_collection(order_payments))))
}
