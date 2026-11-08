use std::collections::BTreeMap;

use sendmock_core::format_rfc3339;

use super::payment_catalogue::{build_provider_ids, read_provider_reference};
use super::payment_change::PaymentChange;
use super::payment_gateway_catalogue::find_payment_gateway;
use super::payment_views::{
    PaymentCaptureMethod, PaymentDetail, PaymentLineItem, PaymentStatus, PaymentSummary,
};
use crate::{AppEventType, OperationContext, OperationError};

/// Where a checkout page sends the customer back; a payment made without a page has none.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ProviderCheckoutUrls {
    pub success_url: Option<String>,
    pub cancel_url: Option<String>,
}

/// A payment a provider's API creates, in the provider-neutral terms of a payment.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderPaymentRequest {
    pub provider: String,
    pub amount_minor: u64,
    /// An ISO code in capitals.
    pub currency: String,
    pub customer_email: Option<String>,
    pub line_items: Vec<PaymentLineItem>,
    pub metadata: BTreeMap<String, String>,
    pub capture_method: PaymentCaptureMethod,
    /// A checkout page for the payment, or none when the app collects the payment itself.
    pub checkout: Option<ProviderCheckoutUrls>,
}

fn take_suffix(payment_id: &str, kept_length: usize) -> String {
    payment_id
        .chars()
        .skip(payment_id.len().saturating_sub(kept_length))
        .collect()
}

fn build_provider_payment(
    operation_context: &OperationContext,
    payment_request: ProviderPaymentRequest,
    provider_name: String,
) -> PaymentDetail {
    let payment_id = operation_context.id_generator.generate_id().to_string();
    let mut provider_ids =
        build_provider_ids(&payment_request.provider, &take_suffix(&payment_id, 12));
    let checkout_urls = payment_request.checkout.clone();
    if checkout_urls.is_none() {
        provider_ids.remove("checkout_session");
    }
    let http_address = &operation_context.instance_details.http_address;
    let checkout_urls_or_default = checkout_urls.clone().unwrap_or_default();
    PaymentDetail {
        summary: PaymentSummary {
            provider_reference: read_provider_reference(&payment_request.provider, &provider_ids)
                .unwrap_or_else(|| payment_id.clone()),
            id: payment_id.clone(),
            provider: payment_request.provider,
            provider_name,
            amount_minor: payment_request.amount_minor,
            currency: payment_request.currency,
            status: PaymentStatus::RequiresPayment,
            customer_email: payment_request.customer_email,
            customer_name: None,
            failure_code: None,
            refunded_minor: 0,
            created_at: format_rfc3339(operation_context.clock.now_unix_ms()),
        },
        provider_ids,
        customer_phone: None,
        method: None,
        line_items: payment_request.line_items,
        metadata: payment_request.metadata,
        success_url: checkout_urls_or_default.success_url,
        fail_url: None,
        cancel_url: checkout_urls_or_default.cancel_url,
        checkout_url: checkout_urls.map(|_| format!("http://{http_address}/pay/{payment_id}")),
        redirect: None,
        captured_minor: 0,
        capture_method: payment_request.capture_method,
        method_key: None,
        dispute: None,
        timeline: Vec::new(),
        notifications: Vec::new(),
    }
}

/// Starts a payment made through a provider's API, firing `payment.created` when it is saved.
pub async fn start_provider_payment(
    operation_context: &OperationContext,
    payment_request: ProviderPaymentRequest,
) -> Result<PaymentChange<'_>, OperationError> {
    let payment_gateway =
        find_payment_gateway(operation_context, &payment_request.provider).await?;
    let has_checkout = payment_request.checkout.is_some();
    let payment = build_provider_payment(
        operation_context,
        payment_request,
        payment_gateway.fields.name,
    );
    let mut payment_change = PaymentChange::start(
        operation_context,
        payment,
        vec![AppEventType::PaymentCreated],
    )
    .await;
    payment_change.add_timeline(
        "created",
        if has_checkout {
            "Checkout session created through the provider's API"
        } else {
            "Payment created through the provider's API"
        },
    );
    Ok(payment_change)
}

/// A new checkout made through a provider's API takes Settings > Payments' outcome profile,
/// as a native checkout does; the provider fills in its URLs first.
pub async fn apply_checkout_outcome_profile(
    payment_change: &mut PaymentChange<'_>,
    operation_context: &OperationContext,
) -> Result<(), OperationError> {
    let app_settings = operation_context.settings_store.current().await?;
    payment_change.apply_outcome_profile(
        app_settings.payment_outcome_profile,
        app_settings.payment_random_success_rate_percent,
    );
    Ok(())
}
