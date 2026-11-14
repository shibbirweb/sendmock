use std::collections::BTreeMap;

use sendmock_core::{format_rfc3339, parse_rfc3339};
use sendmock_payments::{format_major_amount, parse_major_amount};
use serde_json::{Map, Value, json};

use super::bkash_call::{BKASH_PROVIDER_KEY, BkashCall};
use super::bkash_error::{BkashError, mark_successful};
use crate::OperationError;
use crate::payments::{
    PaymentCaptureMethod, PaymentDetail, PaymentInstrument, ProviderCheckoutUrls,
    ProviderPaymentRequest, apply_checkout_outcome_profile, start_provider_payment,
};

/// bKash writes its times in Dhaka, six hours ahead of UTC.
const DHAKA_OFFSET_MS: i64 = 6 * 3_600_000;
const CHECKOUT_MODE: &str = "0011";
const BKASH_CURRENCY: &str = "BDT";
const INVOICE_FIELD: &str = "merchantInvoiceNumber";
const PAYER_REFERENCE_FIELD: &str = "payerReference";
const INTENT_FIELD: &str = "intent";

/// `2023-02-21T15:27:44:610 GMT+0600`, as bKash writes its times.
pub fn format_bkash_time(unix_ms: i64) -> String {
    let dhaka_time: String = format_rfc3339(unix_ms + DHAKA_OFFSET_MS)
        .chars()
        .take(19)
        .collect();
    format!("{dhaka_time}:{:03} GMT+0600", unix_ms.rem_euclid(1000))
}

pub fn read_payment_id(payment: &PaymentDetail) -> &str {
    payment
        .provider_ids
        .get("payment_id")
        .map_or("", String::as_str)
}

/// The payment as the API names it, shared by create, execute and status.
pub fn describe_bkash_payment(payment: &PaymentDetail) -> Map<String, Value> {
    let read_metadata = |field_name: &str| {
        payment
            .metadata
            .get(field_name)
            .cloned()
            .unwrap_or_default()
    };
    let created_unix_ms = parse_rfc3339(&payment.summary.created_at).unwrap_or_default();
    let mut described = Map::new();
    described.insert(
        "paymentID".to_owned(),
        Value::from(read_payment_id(payment)),
    );
    described.insert("mode".to_owned(), Value::from(CHECKOUT_MODE));
    described.insert(
        "paymentCreateTime".to_owned(),
        Value::from(format_bkash_time(created_unix_ms)),
    );
    described.insert(
        "amount".to_owned(),
        Value::from(format_major_amount(
            payment.summary.amount_minor,
            &payment.summary.currency,
        )),
    );
    described.insert(
        "currency".to_owned(),
        Value::from(payment.summary.currency.clone()),
    );
    described.insert(
        INTENT_FIELD.to_owned(),
        Value::from(read_metadata(INTENT_FIELD)),
    );
    described.insert(
        INVOICE_FIELD.to_owned(),
        Value::from(read_metadata(INVOICE_FIELD)),
    );
    described.insert(
        PAYER_REFERENCE_FIELD.to_owned(),
        Value::from(read_metadata(PAYER_REFERENCE_FIELD)),
    );
    described
}

/// The wallet that paid, masked as SendMock keeps it.
pub fn read_customer_msisdn(payment: &PaymentDetail) -> String {
    match &payment.method {
        Some(PaymentInstrument::Wallet { masked_number, .. }) => masked_number.clone(),
        _ => String::new(),
    }
}

fn add_query_field(callback_url: &str, status: &str, payment_id: &str) -> String {
    let separator = if callback_url.contains('?') { '&' } else { '?' };
    format!("{callback_url}{separator}paymentID={payment_id}&status={status}")
}

/// The fields `create` refuses, in the order bKash checks them.
fn check_create_fields(
    bkash_call: &BkashCall<'_>,
) -> Result<(u64, PaymentCaptureMethod), BkashError> {
    let has_required_fields = [
        "mode",
        "callbackURL",
        "amount",
        "currency",
        INTENT_FIELD,
        INVOICE_FIELD,
    ]
    .iter()
    .all(|field_name| bkash_call.read_field(field_name).is_some());
    if !has_required_fields || bkash_call.read_field("mode").as_deref() != Some(CHECKOUT_MODE) {
        return Err(BkashError::INVALID_REQUEST_BODY);
    }
    if bkash_call.read_field("currency").as_deref() != Some(BKASH_CURRENCY) {
        return Err(BkashError::INVALID_CURRENCY);
    }
    let capture_method = match bkash_call.read_field(INTENT_FIELD).as_deref() {
        Some("sale") => PaymentCaptureMethod::Automatic,
        Some("authorization") => PaymentCaptureMethod::Manual,
        _ => return Err(BkashError::INVALID_INTENT),
    };
    match parse_major_amount(
        &bkash_call.read_field("amount").unwrap_or_default(),
        BKASH_CURRENCY,
    ) {
        Some(amount_minor) if amount_minor > 0 => Ok((amount_minor, capture_method)),
        _ => Err(BkashError::INVALID_AMOUNT),
    }
}

fn build_payment_request(
    bkash_call: &BkashCall<'_>,
    amount_minor: u64,
    capture_method: PaymentCaptureMethod,
) -> ProviderPaymentRequest {
    let callback_url = bkash_call.read_field("callbackURL");
    let metadata: BTreeMap<String, String> = [INTENT_FIELD, INVOICE_FIELD, PAYER_REFERENCE_FIELD]
        .iter()
        .filter_map(|field_name| {
            bkash_call
                .read_field(field_name)
                .map(|field_value| ((*field_name).to_owned(), field_value))
        })
        .collect();
    ProviderPaymentRequest {
        provider: BKASH_PROVIDER_KEY.to_owned(),
        amount_minor,
        currency: BKASH_CURRENCY.to_owned(),
        customer_email: None,
        line_items: Vec::new(),
        metadata,
        capture_method,
        checkout: Some(ProviderCheckoutUrls {
            success_url: callback_url.clone(),
            cancel_url: callback_url,
        }),
    }
}

/// `POST /tokenized/checkout/create`: a payment with this instance's checkout page as
/// `bkashURL`; every outcome comes back to `callbackURL` with `paymentID` and `status`.
pub async fn create_payment(bkash_call: &BkashCall<'_>) -> Result<Value, OperationError> {
    if let Err(header_error) = bkash_call.check_payment_headers() {
        return Ok(header_error.describe());
    }
    let (amount_minor, capture_method) = match check_create_fields(bkash_call) {
        Ok(checked_fields) => checked_fields,
        Err(field_error) => return Ok(field_error.describe()),
    };
    let operation_context = bkash_call.operation_context;
    let payment_request = build_payment_request(bkash_call, amount_minor, capture_method);
    let mut payment_change = start_provider_payment(operation_context, payment_request).await?;
    payment_change.payment.fail_url = bkash_call.read_field("callbackURL");
    payment_change.payment.customer_phone = bkash_call.read_field(PAYER_REFERENCE_FIELD);
    apply_checkout_outcome_profile(&mut payment_change, operation_context).await?;
    let payment = payment_change.save().await?;
    let callback_url = bkash_call.read_field("callbackURL").unwrap_or_default();
    let payment_id = read_payment_id(&payment);
    let mut created = describe_bkash_payment(&payment);
    created.remove("mode");
    created.insert("transactionStatus".to_owned(), Value::from("Initiated"));
    let urls = json!({
        "bkashURL": payment.checkout_url,
        "callbackURL": callback_url,
        "successCallbackURL": add_query_field(&callback_url, "success", payment_id),
        "failureCallbackURL": add_query_field(&callback_url, "failure", payment_id),
        "cancelledCallbackURL": add_query_field(&callback_url, "cancel", payment_id),
    });
    if let Value::Object(url_fields) = urls {
        created.extend(url_fields);
    }
    Ok(mark_successful(Value::Object(created)))
}
