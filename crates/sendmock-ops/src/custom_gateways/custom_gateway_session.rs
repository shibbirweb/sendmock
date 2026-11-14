use sendmock_payments::{
    currency_exponent, format_major_amount, is_currency_code, parse_major_amount,
};
use serde_json::json;

use super::custom_gateway_call::{CustomGatewayAnswer, CustomGatewayCall, CustomGatewayRefusal};
use crate::OperationError;
use crate::payments::{
    PaymentCaptureMethod, PaymentLineItem, ProviderCheckoutUrls, ProviderPaymentRequest,
    apply_checkout_outcome_profile, start_provider_payment,
};

/// The currency asked for, else Settings > Payments' default.
async fn read_currency(
    custom_gateway_call: &CustomGatewayCall<'_>,
) -> Result<Result<String, CustomGatewayRefusal>, OperationError> {
    let Some(currency) = custom_gateway_call.read_text("currency") else {
        let app_settings = custom_gateway_call
            .operation_context
            .settings_store
            .current()
            .await?;
        return Ok(Ok(app_settings.payment_default_currency));
    };
    let currency = currency.to_ascii_uppercase();
    if !is_currency_code(&currency) {
        return Ok(Err(CustomGatewayRefusal::invalid_field(
            "currency",
            format!("{currency} is not a currency code"),
        )));
    }
    Ok(Ok(currency))
}

/// The amount in minor units, from major units with no more decimals than the currency has.
fn read_amount_minor(
    custom_gateway_call: &CustomGatewayCall<'_>,
    currency: &str,
) -> Result<u64, CustomGatewayRefusal> {
    let Some(amount_text) = custom_gateway_call.read_text("amount") else {
        return Err(CustomGatewayRefusal::invalid_field(
            "amount",
            "amount is required".to_owned(),
        ));
    };
    parse_major_amount(&amount_text, currency)
        .filter(|amount_minor| *amount_minor > 0)
        .ok_or_else(|| {
            CustomGatewayRefusal::invalid_field(
                "amount",
                format!(
                    "amount must be more than 0 in major units, with at most {} decimals for {currency}",
                    currency_exponent(currency)
                ),
            )
        })
}

fn build_payment_request(
    custom_gateway_call: &CustomGatewayCall<'_>,
    amount_minor: u64,
    currency: String,
) -> ProviderPaymentRequest {
    let line_items = custom_gateway_call
        .read_text("description")
        .map(|description| PaymentLineItem {
            name: description,
            quantity: 1,
            unit_amount_minor: amount_minor,
        })
        .into_iter()
        .collect();
    ProviderPaymentRequest {
        provider: custom_gateway_call.gateway_fields.key.clone(),
        amount_minor,
        currency,
        customer_email: custom_gateway_call.read_text("customer_email"),
        line_items,
        metadata: custom_gateway_call.read_metadata(),
        capture_method: PaymentCaptureMethod::Automatic,
        checkout: Some(ProviderCheckoutUrls {
            success_url: custom_gateway_call.read_text("success_url"),
            cancel_url: custom_gateway_call.read_text("cancel_url"),
        }),
    }
}

/// `POST /providers/<gatewayKey>/checkout`: a payment waiting on this instance's checkout
/// page, under the app's `reference` when it sends one.
pub async fn init_custom_checkout(
    custom_gateway_call: &CustomGatewayCall<'_>,
) -> Result<CustomGatewayAnswer, OperationError> {
    let currency = match read_currency(custom_gateway_call).await? {
        Ok(currency) => currency,
        Err(refusal) => return Ok(refusal.to_answer()),
    };
    let amount_minor = match read_amount_minor(custom_gateway_call, &currency) {
        Ok(amount_minor) => amount_minor,
        Err(refusal) => return Ok(refusal.to_answer()),
    };
    let operation_context = custom_gateway_call.operation_context;
    let payment_request = build_payment_request(custom_gateway_call, amount_minor, currency);
    let mut payment_change = start_provider_payment(operation_context, payment_request).await?;
    let payment = &mut payment_change.payment;
    payment.fail_url = custom_gateway_call.read_text("fail_url");
    payment.summary.customer_name = custom_gateway_call.read_text("customer_name");
    if let Some(app_reference) = custom_gateway_call.read_text("reference") {
        payment
            .summary
            .provider_reference
            .clone_from(&app_reference);
        payment
            .provider_ids
            .insert("reference".to_owned(), app_reference);
    }
    apply_checkout_outcome_profile(&mut payment_change, operation_context).await?;
    let payment = payment_change.save().await?;
    Ok(CustomGatewayAnswer::json(
        201,
        &json!({
            "payment_id": payment.summary.id,
            "reference": payment.summary.provider_reference,
            "status": payment.summary.status.as_str(),
            "amount": format_major_amount(payment.summary.amount_minor, &payment.summary.currency),
            "currency": payment.summary.currency,
            "checkout_url": payment.checkout_url,
        }),
    ))
}
