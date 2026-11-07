use std::collections::BTreeMap;

use sendmock_payments::{is_currency_code, parse_major_amount};
use serde_json::{Value, json};

use super::sslcommerz_call::{SSLCOMMERZ_PROVIDER_KEY, SslcommerzCall};
use crate::OperationError;
use crate::payments::{
    PaymentCaptureMethod, PaymentDetail, PaymentLineItem, ProviderCheckoutUrls,
    ProviderPaymentRequest, apply_checkout_outcome_profile, start_provider_payment,
};

pub const STORE_CREDENTIAL_ERROR: &str = "Store Credential Error Or Store is De-active";
const REQUIRED_FIELDS: [&str; 6] = [
    "total_amount",
    "currency",
    "tran_id",
    "success_url",
    "fail_url",
    "cancel_url",
];
const PASSED_ON_FIELDS: [&str; 4] = ["value_a", "value_b", "value_c", "value_d"];
const MOBILE_BANKING_KEYS: [&str; 4] = ["bkash", "nagad", "rocket", "upay"];
const EMPTY_SESSION_FIELDS: [&str; 7] = [
    "redirectGatewayURL",
    "directPaymentURLBank",
    "directPaymentURLCard",
    "directPaymentURL",
    "redirectGatewayURLFailed",
    "storeBanner",
    "storeLogo",
];

/// SSLCommerz's refusal: `status` `FAILED` with the reason and every session field empty.
pub fn describe_failed_session(failed_reason: &str) -> Value {
    let mut failed_session = json!({
        "status": "FAILED",
        "failedreason": failed_reason,
        "sessionkey": "",
        "gw": [],
        "GatewayPageURL": "",
        "desc": [],
        "is_direct_pay_enable": "",
    });
    for empty_field in EMPTY_SESSION_FIELDS {
        failed_session[empty_field] = Value::from("");
    }
    failed_session
}

fn describe_invalid_field(field_name: &str, problem: &str) -> Value {
    describe_failed_session(&format!(
        "Invalid Information! '{field_name}' is {problem}."
    ))
}

/// The gateway's methods by SSLCommerz's groups, as `gw` lists them.
fn describe_method_groups(method_keys: &[String]) -> Value {
    let join_keys = |is_in_group: &dyn Fn(&str) -> bool| {
        method_keys
            .iter()
            .filter(|method_key| method_key.as_str() != "card" && is_in_group(method_key))
            .cloned()
            .collect::<Vec<_>>()
            .join(",")
    };
    let card_text = |card_gateway: &str| {
        if method_keys.iter().any(|method_key| method_key == "card") {
            card_gateway.to_owned()
        } else {
            String::new()
        }
    };
    json!({
        "visa": card_text("visacard"),
        "master": card_text("mastercard"),
        "amex": card_text("amexcard"),
        "othercards": "",
        "internetbanking": join_keys(&|method_key| !MOBILE_BANKING_KEYS.contains(&method_key)),
        "mobilebanking": join_keys(&|method_key| MOBILE_BANKING_KEYS.contains(&method_key)),
    })
}

fn build_payment_request(
    sslcommerz_call: &SslcommerzCall<'_>,
    amount_minor: u64,
    currency: String,
) -> ProviderPaymentRequest {
    let read_text = |field_name: &str| sslcommerz_call.read_field(field_name).map(str::to_owned);
    let line_items = read_text("product_name")
        .map(|product_name| PaymentLineItem {
            name: product_name,
            quantity: 1,
            unit_amount_minor: amount_minor,
        })
        .into_iter()
        .collect();
    let metadata: BTreeMap<String, String> = PASSED_ON_FIELDS
        .iter()
        .filter_map(|field_name| {
            read_text(field_name).map(|value| ((*field_name).to_owned(), value))
        })
        .collect();
    ProviderPaymentRequest {
        provider: SSLCOMMERZ_PROVIDER_KEY.to_owned(),
        amount_minor,
        currency,
        customer_email: read_text("cus_email"),
        line_items,
        metadata,
        capture_method: PaymentCaptureMethod::Automatic,
        checkout: Some(ProviderCheckoutUrls {
            success_url: read_text("success_url"),
            cancel_url: read_text("cancel_url"),
        }),
    }
}

fn make_session_key(sslcommerz_call: &SslcommerzCall<'_>) -> String {
    let random_source = &sslcommerz_call.operation_context.random_source;
    format!(
        "{:016X}{:016X}",
        random_source.next_u64(),
        random_source.next_u64()
    )
}

fn describe_session(sslcommerz_call: &SslcommerzCall<'_>, payment: &PaymentDetail) -> Value {
    let mut session = json!({
        "status": "SUCCESS",
        "failedreason": "",
        "sessionkey": payment.provider_ids.get("sessionkey"),
        "gw": describe_method_groups(&sslcommerz_call.gateway_fields.method_keys),
        "GatewayPageURL": payment.checkout_url,
        "store_name": sslcommerz_call.gateway_fields.name,
        "desc": [],
        "is_direct_pay_enable": "0",
    });
    for empty_field in EMPTY_SESSION_FIELDS {
        session[empty_field] = Value::from("");
    }
    session
}

/// The amount and currency, or SSLCommerz's refusal naming the field.
fn read_amount(sslcommerz_call: &SslcommerzCall<'_>) -> Result<(u64, String), Value> {
    let currency = sslcommerz_call
        .read_field("currency")
        .unwrap_or_default()
        .to_ascii_uppercase();
    if !is_currency_code(&currency) {
        return Err(describe_invalid_field("currency", "invalid"));
    }
    let total_amount = sslcommerz_call
        .read_field("total_amount")
        .unwrap_or_default();
    match parse_major_amount(total_amount, &currency) {
        Some(amount_minor) if amount_minor > 0 => Ok((amount_minor, currency)),
        _ => Err(describe_invalid_field("total_amount", "invalid")),
    }
}

/// `POST /gwprocess/v4/api.php`: a payment with this instance's checkout page as
/// `GatewayPageURL`, under the app's `tran_id`.
pub async fn init_session(sslcommerz_call: &SslcommerzCall<'_>) -> Result<Value, OperationError> {
    if !sslcommerz_call.has_store_credentials() {
        return Ok(describe_failed_session(STORE_CREDENTIAL_ERROR));
    }
    if let Some(missing_field) = REQUIRED_FIELDS
        .iter()
        .find(|field_name| sslcommerz_call.read_field(field_name).is_none())
    {
        return Ok(describe_invalid_field(missing_field, "missing"));
    }
    let (amount_minor, currency) = match read_amount(sslcommerz_call) {
        Ok(amount) => amount,
        Err(refusal) => return Ok(refusal),
    };
    let operation_context = sslcommerz_call.operation_context;
    let payment_request = build_payment_request(sslcommerz_call, amount_minor, currency);
    let mut payment_change = start_provider_payment(operation_context, payment_request).await?;
    let read_text = |field_name: &str| sslcommerz_call.read_field(field_name).map(str::to_owned);
    let payment = &mut payment_change.payment;
    payment.fail_url = read_text("fail_url");
    payment.summary.customer_name = read_text("cus_name");
    payment.customer_phone = read_text("cus_phone");
    let tran_id = read_text("tran_id").unwrap_or_default();
    payment.summary.provider_reference.clone_from(&tran_id);
    payment.provider_ids.insert("tran_id".to_owned(), tran_id);
    payment
        .provider_ids
        .insert("sessionkey".to_owned(), make_session_key(sslcommerz_call));
    apply_checkout_outcome_profile(&mut payment_change, operation_context).await?;
    let payment = payment_change.save().await?;
    Ok(describe_session(sslcommerz_call, &payment))
}
