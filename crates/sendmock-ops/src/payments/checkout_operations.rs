use std::collections::BTreeMap;

use sendmock_core::format_rfc3339;
use sendmock_payments::is_currency_code;

use super::checkout_views::{
    CheckoutSession, CheckoutSessionReference, CheckoutState, PaymentCheckoutCreateRequest,
};
use super::payment_catalogue::{
    add_timeline_event, build_provider_ids, find_payment, read_provider_reference,
};
use super::payment_change::PaymentChange;
use super::payment_flow_catalogue::{
    load_method_flow_keys, load_payment_flows, present_with_usage,
};
use super::payment_gateway_catalogue::find_payment_gateway;
use super::payment_method_catalogue::list_presented_methods;
use super::payment_method_views::PaymentMethodDefinition;
use super::payment_views::{PaymentDetail, PaymentLineItem, PaymentStatus, PaymentSummary};
use crate::{
    AppEventType, HttpMethod, Operation, OperationContext, OperationDefinition, OperationError,
    SuccessStatus,
};

/// The app's pages a test checkout sends the customer back to.
const SHOP_URL: &str = "http://localhost:8000/checkout";

/// Where the checkout stands for the customer, from the payment.
pub fn read_checkout_state(payment: &PaymentDetail) -> CheckoutState {
    match payment.summary.status {
        PaymentStatus::RequiresAction => CheckoutState::RequiresThreeDs,
        PaymentStatus::RequiresPayment if payment.checkout_url.is_none() => CheckoutState::Pending,
        PaymentStatus::RequiresPayment => CheckoutState::Open,
        PaymentStatus::Failed => CheckoutState::Failed,
        PaymentStatus::Canceled if payment.summary.failure_code.as_deref() == Some("expired") => {
            CheckoutState::Expired
        }
        PaymentStatus::Canceled => CheckoutState::Canceled,
        _ => CheckoutState::Completed,
    }
}

fn check_checkout_request(
    input: &PaymentCheckoutCreateRequest,
    currency: &str,
) -> Result<(), OperationError> {
    let invalid_field = |field: &str, message: &str| OperationError::InvalidInput {
        message: message.to_owned(),
        field: Some(field.to_owned()),
    };
    if input.amount_minor == 0 {
        return Err(invalid_field(
            "amount_minor",
            "Use an amount above 0, in minor units",
        ));
    }
    if !is_currency_code(currency) {
        return Err(invalid_field(
            "currency",
            "Use a three-letter currency code like BDT or USD",
        ));
    }
    Ok(())
}

/// One "Test order" line for the whole amount, when the request lists none.
fn default_line_items(amount_minor: u64) -> Vec<PaymentLineItem> {
    vec![PaymentLineItem {
        name: "Test order".to_owned(),
        quantity: 1,
        unit_amount_minor: amount_minor,
    }]
}

/// A new payment waiting on its checkout page.
fn build_checkout_payment(
    operation_context: &OperationContext,
    input: PaymentCheckoutCreateRequest,
    provider_name: String,
    currency: String,
) -> PaymentDetail {
    let payment_id = operation_context.id_generator.generate_id().to_string();
    let suffix: String = payment_id
        .chars()
        .skip(payment_id.len().saturating_sub(12))
        .collect();
    let provider_ids = build_provider_ids(&input.provider, &suffix);
    let http_address = &operation_context.instance_details.http_address;
    let line_items = input
        .line_items
        .unwrap_or_else(|| default_line_items(input.amount_minor));
    let order_suffix: String = payment_id
        .chars()
        .skip(payment_id.len().saturating_sub(6))
        .collect();
    PaymentDetail {
        summary: PaymentSummary {
            provider_reference: read_provider_reference(&input.provider, &provider_ids)
                .unwrap_or_else(|| payment_id.clone()),
            id: payment_id.clone(),
            provider: input.provider,
            provider_name,
            amount_minor: input.amount_minor,
            currency,
            status: PaymentStatus::RequiresPayment,
            customer_email: Some(
                input
                    .customer_email
                    .unwrap_or_else(|| "test@example.com".to_owned()),
            ),
            customer_name: Some("Test Customer".to_owned()),
            failure_code: None,
            refunded_minor: 0,
            created_at: format_rfc3339(operation_context.clock.now_unix_ms()),
        },
        provider_ids,
        customer_phone: None,
        method: None,
        line_items,
        metadata: BTreeMap::from([("order_id".to_owned(), format!("ord_{order_suffix}"))]),
        success_url: Some(format!("{SHOP_URL}/success")),
        fail_url: Some(format!("{SHOP_URL}/fail")),
        cancel_url: Some(format!("{SHOP_URL}/cancel")),
        checkout_url: Some(format!("http://{http_address}/pay/{payment_id}")),
        redirect: None,
        captured_minor: 0,
        method_key: None,
        dispute: None,
        timeline: Vec::new(),
        notifications: Vec::new(),
    }
}

pub struct CreatePaymentCheckoutOperation;

impl Operation for CreatePaymentCheckoutOperation {
    type Input = PaymentCheckoutCreateRequest;
    type Output = PaymentDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postPaymentsCheckout",
            method: HttpMethod::Post,
            path: "/api/v1/payments/checkout",
            summary: "Start a hosted checkout on a gateway and get its payment page URL.",
            cli_usage: "sendmock payments checkout create",
            mcp_tool: "sendmock_payment_create_checkout",
            success_status: SuccessStatus::Created,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Any gateway, custom ones included; the payment waits for its checkout page.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentCheckoutCreateRequest,
    ) -> Result<PaymentDetail, OperationError> {
        let payment_gateway = find_payment_gateway(operation_context, &input.provider)
            .await
            .map_err(|_| OperationError::InvalidInput {
                message: format!("There is no gateway with the key {}", input.provider),
                field: Some("provider".to_owned()),
            })?;
        let app_settings = operation_context.settings_store.current().await?;
        let currency = input
            .currency
            .clone()
            .map_or(app_settings.payment_default_currency, |currency| {
                currency.to_ascii_uppercase()
            });
        check_checkout_request(&input, &currency)?;
        let mut payment = build_checkout_payment(
            operation_context,
            input,
            payment_gateway.fields.name,
            currency,
        );
        add_timeline_event(
            operation_context,
            &mut payment,
            "created",
            "Test checkout session created",
        );
        let mut payment_change = PaymentChange::start(
            operation_context,
            payment,
            vec![AppEventType::PaymentCreated],
        )
        .await;
        payment_change.apply_outcome_profile(
            app_settings.payment_outcome_profile,
            app_settings.payment_random_success_rate_percent,
        );
        payment_change.save().await
    }
}

pub struct GetCheckoutSessionOperation;

impl Operation for GetCheckoutSessionOperation {
    type Input = CheckoutSessionReference;
    type Output = CheckoutSession;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getCheckoutSessionsBySessionId",
            method: HttpMethod::Get,
            path: "/api/v1/checkout-sessions/{sessionId}",
            summary: "What a test checkout page shows: order, methods and flows.",
            is_read_only: true,
            cli_usage: "sendmock payments checkout show <sessionId>",
            mcp_tool: "sendmock_checkout_get",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: CheckoutSessionReference,
    ) -> Result<CheckoutSession, OperationError> {
        let payment = find_payment(operation_context, &input.session_id).await?;
        build_checkout_session(operation_context, payment).await
    }
}

/// The checkout page's view of a payment: the gateway's enabled methods in its order, and the
/// flows they run.
pub async fn build_checkout_session(
    operation_context: &OperationContext,
    payment: PaymentDetail,
) -> Result<CheckoutSession, OperationError> {
    let payment_gateway =
        find_payment_gateway(operation_context, &payment.summary.provider).await?;
    let presented_methods = list_presented_methods(operation_context).await?;
    let gateway_methods: Vec<PaymentMethodDefinition> = payment_gateway
        .fields
        .method_keys
        .iter()
        .filter_map(|method_key| {
            presented_methods
                .iter()
                .find(|payment_method| {
                    &payment_method.fields.key == method_key && payment_method.fields.is_enabled
                })
                .cloned()
        })
        .collect();
    let method_flow_keys = load_method_flow_keys(operation_context).await?;
    let flows = load_payment_flows(operation_context)
        .await?
        .into_iter()
        .filter(|payment_flow| {
            gateway_methods
                .iter()
                .any(|payment_method| payment_method.fields.flow == payment_flow.key)
        })
        .map(|payment_flow| present_with_usage(payment_flow, &method_flow_keys))
        .collect();
    let app_settings = operation_context.settings_store.current().await?;
    Ok(CheckoutSession {
        session_id: payment.summary.id.clone(),
        payment_id: payment.summary.id.clone(),
        state: read_checkout_state(&payment),
        provider: payment.summary.provider,
        provider_name: payment_gateway.fields.name,
        merchant_name: app_settings.payment_merchant_name,
        amount_minor: payment.summary.amount_minor,
        currency: payment.summary.currency,
        line_items: payment.line_items,
        customer_email: payment.summary.customer_email,
        accent: payment_gateway.fields.accent,
        methods: gateway_methods,
        flows,
        failure_code: payment.summary.failure_code,
        redirect: payment.redirect,
    })
}
