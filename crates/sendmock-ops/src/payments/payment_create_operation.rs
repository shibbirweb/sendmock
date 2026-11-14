use std::collections::BTreeMap;

use schemars::JsonSchema;
use sendmock_payments::is_currency_code;
use serde::Deserialize;

use super::checkout_payment_run::pay_with_test_card;
use super::payment_views::{PaymentCaptureMethod, PaymentDetail, PaymentLineItem, PaymentStatus};
use super::provider_payment::{ProviderPaymentRequest, start_provider_payment};
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError, SuccessStatus,
};

/// Body of `POST /api/v1/payments`: a payment the app's server pays with a test card.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct PaymentCreateRequest {
    /// The gateway's key, e.g. `stripe`.
    pub provider: String,
    /// In the currency's minor units; JPY has none.
    pub amount_minor: u64,
    /// Three letters, stored in capitals; the default currency from Settings > Payments when
    /// left out.
    pub currency: Option<String>,
    /// A test card of the card method; a number its table does not list is refused.
    pub card_number: String,
    pub customer_email: Option<String>,
    /// One "Test order" line for the amount when left out.
    pub line_items: Option<Vec<PaymentLineItem>>,
    /// `manual` authorizes the payment and waits for a capture or void.
    pub capture_method: Option<PaymentCaptureMethod>,
}

fn invalid_field(field_name: &str, message: &str) -> OperationError {
    OperationError::InvalidInput {
        message: message.to_owned(),
        field: Some(field_name.to_owned()),
    }
}

/// The payment's currency in capitals, once the amount and the code are usable.
fn read_checked_currency(
    input: &PaymentCreateRequest,
    default_currency: String,
) -> Result<String, OperationError> {
    let currency = input
        .currency
        .as_deref()
        .map_or(default_currency, str::to_ascii_uppercase);
    if input.amount_minor == 0 {
        return Err(invalid_field(
            "amount_minor",
            "Use an amount above 0, in minor units",
        ));
    }
    if !is_currency_code(&currency) {
        return Err(invalid_field(
            "currency",
            "Use a three-letter currency code like BDT or USD",
        ));
    }
    Ok(currency)
}

fn build_payment_request(input: PaymentCreateRequest, currency: String) -> ProviderPaymentRequest {
    let line_items = input.line_items.unwrap_or_else(|| {
        vec![PaymentLineItem {
            name: "Test order".to_owned(),
            quantity: 1,
            unit_amount_minor: input.amount_minor,
        }]
    });
    ProviderPaymentRequest {
        provider: input.provider,
        amount_minor: input.amount_minor,
        currency,
        customer_email: input.customer_email,
        line_items,
        metadata: BTreeMap::new(),
        capture_method: input.capture_method.unwrap_or_default(),
        checkout: None,
    }
}

pub struct CreatePaymentOperation;

impl Operation for CreatePaymentOperation {
    type Input = PaymentCreateRequest;
    type Output = PaymentDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postPayments",
            method: HttpMethod::Post,
            path: "/api/v1/payments",
            summary: "Create a payment and pay it with a test card, as an app's server does without a checkout page.",
            cli_usage: "sendmock payments create",
            mcp_tool: "sendmock_payment_create",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// The card's outcome from the test card table decides the payment, as on the checkout
    /// page; a card that asks for 3-D Secure fails, as there is no page to approve it on. A
    /// refused card changes nothing, so nothing is stored.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentCreateRequest,
    ) -> Result<PaymentDetail, OperationError> {
        let app_settings = operation_context.settings_store.current().await?;
        let currency = read_checked_currency(&input, app_settings.payment_default_currency)?;
        let card_number = input.card_number.replace(' ', "");
        let mut payment_change =
            start_provider_payment(operation_context, build_payment_request(input, currency))
                .await?;
        pay_with_test_card(&mut payment_change, operation_context, &card_number).await?;
        if payment_change.payment.summary.status == PaymentStatus::RequiresAction {
            payment_change.decline("authentication_failed");
        }
        payment_change.save().await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn build_input(amount_minor: u64, currency: Option<&str>) -> PaymentCreateRequest {
        PaymentCreateRequest {
            provider: "stripe".to_owned(),
            amount_minor,
            currency: currency.map(str::to_owned),
            card_number: "4242424242424242".to_owned(),
            customer_email: None,
            line_items: None,
            capture_method: None,
        }
    }

    // AC: PY-02.3
    #[test]
    fn the_currency_is_stored_in_capitals_or_taken_from_the_settings() {
        let yen = read_checked_currency(&build_input(1500, Some("jpy")), "USD".to_owned());
        let default = read_checked_currency(&build_input(1999, None), "BDT".to_owned());

        assert_eq!(yen.ok().as_deref(), Some("JPY"));
        assert_eq!(default.ok().as_deref(), Some("BDT"));
        assert!(read_checked_currency(&build_input(1999, Some("US")), "USD".to_owned()).is_err());
        assert!(read_checked_currency(&build_input(0, Some("USD")), "USD".to_owned()).is_err());
    }
}
