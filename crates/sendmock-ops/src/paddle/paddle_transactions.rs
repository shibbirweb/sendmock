use std::collections::BTreeMap;

use sendmock_payments::is_currency_code;
use sendmock_store::PaymentListFilter;
use serde_json::{Value, json};

use super::paddle_call::{PADDLE_PROVIDER_KEY, PaddleCall};
use super::paddle_entities::describe_transaction;
use super::paddle_error::{PaddleAnswer, PaddleError};
use crate::OperationError;
use crate::payments::{
    PaymentCaptureMethod, PaymentLineItem, ProviderCheckoutUrls, ProviderPaymentRequest,
    apply_checkout_outcome_profile, read_payment_document, start_provider_payment,
};

/// A non-catalog item: its name, quantity, unit amount and currency.
fn read_item(item: &Value) -> Result<(PaymentLineItem, String), PaddleError> {
    if item.get("price_id").is_some() {
        return Err(PaddleError::invalid_field(
            "items.price_id: SendMock has no catalog, so send a non-catalog price",
        ));
    }
    let price = item
        .get("price")
        .ok_or_else(|| PaddleError::invalid_field("items.price is required"))?;
    let unit_price = &price["unit_price"];
    let currency_code = unit_price["currency_code"]
        .as_str()
        .unwrap_or_default()
        .to_ascii_uppercase();
    if !is_currency_code(&currency_code) {
        return Err(PaddleError::invalid_field(
            "items.price.unit_price.currency_code is invalid",
        ));
    }
    let unit_amount_minor = unit_price["amount"]
        .as_str()
        .and_then(|amount_text| amount_text.parse::<u64>().ok())
        .ok_or_else(|| {
            PaddleError::invalid_field(
                "items.price.unit_price.amount must be a string of a whole number",
            )
        })?;
    let name = [
        &price["name"],
        &price["description"],
        &price["product"]["name"],
    ]
    .into_iter()
    .find_map(Value::as_str)
    .unwrap_or("Item")
    .to_owned();
    let quantity = item["quantity"]
        .as_u64()
        .and_then(|quantity| u32::try_from(quantity).ok())
        .unwrap_or(1)
        .max(1);
    Ok((
        PaymentLineItem {
            name,
            quantity,
            unit_amount_minor,
        },
        currency_code,
    ))
}

fn read_items(paddle_call: &PaddleCall<'_>) -> Result<(Vec<PaymentLineItem>, String), PaddleError> {
    let items = paddle_call
        .body_fields
        .get("items")
        .and_then(Value::as_array)
        .filter(|items| !items.is_empty())
        .ok_or_else(|| PaddleError::invalid_field("items is required"))?;
    let mut line_items = Vec::new();
    let mut currency_codes = Vec::new();
    for item in items {
        let (line_item, currency_code) = read_item(item)?;
        line_items.push(line_item);
        currency_codes.push(currency_code);
    }
    currency_codes.dedup();
    match currency_codes.as_slice() {
        [currency_code] => Ok((line_items, currency_code.clone())),
        _ => Err(PaddleError::invalid_field(
            "items must all be in one currency",
        )),
    }
}

fn read_custom_data(paddle_call: &PaddleCall<'_>) -> BTreeMap<String, String> {
    let Some(Value::Object(custom_data)) = paddle_call.body_fields.get("custom_data") else {
        return BTreeMap::new();
    };
    custom_data
        .iter()
        .map(|(data_name, data_value)| {
            let data_text = data_value
                .as_str()
                .map_or_else(|| data_value.to_string(), str::to_owned);
            (data_name.clone(), data_text)
        })
        .collect()
}

/// `POST /transactions`: a transaction with this instance's checkout page as `checkout.url`.
pub async fn create_transaction(
    paddle_call: &PaddleCall<'_>,
) -> Result<PaddleAnswer, OperationError> {
    let (line_items, currency) = match read_items(paddle_call) {
        Ok(read_items) => read_items,
        Err(paddle_error) => return Ok(Err(paddle_error)),
    };
    let amount_minor = line_items
        .iter()
        .map(|line_item| line_item.unit_amount_minor * u64::from(line_item.quantity))
        .sum();
    let payment_request = ProviderPaymentRequest {
        provider: PADDLE_PROVIDER_KEY.to_owned(),
        amount_minor,
        currency,
        customer_email: None,
        line_items,
        metadata: read_custom_data(paddle_call),
        capture_method: PaymentCaptureMethod::Automatic,
        checkout: Some(ProviderCheckoutUrls::default()),
    };
    let operation_context = paddle_call.operation_context;
    let mut payment_change = start_provider_payment(operation_context, payment_request).await?;
    apply_checkout_outcome_profile(&mut payment_change, operation_context).await?;
    let payment = payment_change.save().await?;
    Ok(Ok((201, describe_transaction(&payment))))
}

/// `GET /transactions/{transactionId}`.
pub async fn get_transaction(
    paddle_call: &PaddleCall<'_>,
    transaction_id: &str,
) -> Result<PaddleAnswer, OperationError> {
    Ok(paddle_call
        .find_transaction(transaction_id)
        .await?
        .map(|payment| (200, describe_transaction(&payment)))
        .ok_or_else(|| PaddleError::not_found(transaction_id)))
}

/// `GET /transactions`: the Paddle transactions, newest first (the first page).
pub async fn list_transactions(
    paddle_call: &PaddleCall<'_>,
) -> Result<PaddleAnswer, OperationError> {
    let provider_filter = PaymentListFilter {
        provider: Some(PADDLE_PROVIDER_KEY.to_owned()),
        ..PaymentListFilter::default()
    };
    let payment_page = paddle_call
        .operation_context
        .payment_repository
        .list_payments(provider_filter, None, 50)
        .await?;
    let transactions: Vec<Value> = payment_page
        .payments
        .iter()
        .map(|stored_payment| {
            read_payment_document(stored_payment).map(|payment| describe_transaction(&payment))
        })
        .collect::<Result<_, _>>()?;
    Ok(Ok((200, json!(transactions))))
}
