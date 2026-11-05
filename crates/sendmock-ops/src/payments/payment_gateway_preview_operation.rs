use std::collections::BTreeMap;

use sendmock_store::PaymentListFilter;
use serde_json::{Map, Value};

use super::gateway_template_rendering::{
    GatewayPartRenderer, GatewayRenderOptions, build_gateway_context, redirect_method_name,
};
use super::payment_catalogue::{find_payment, read_payment_document};
use super::payment_gateway_catalogue::find_payment_gateway;
use super::payment_gateway_operations::gateway_definition;
use super::payment_gateway_preview_views::{
    GatewayPreviewNotification, GatewayPreviewRedirect, PaymentGatewayPreview,
    PaymentGatewayPreviewRequest,
};
use super::payment_gateway_views::PaymentGatewayFields;
use super::payment_redirect::read_redirect_url;
use super::payment_views::PaymentDetail;
use crate::message_providers::{TemplateHelperEntry, build_template_reference, merge_credentials};
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

/// The id every preview notification carries, so a preview is never taken for a delivery.
const PREVIEW_EVENT_ID: &str = "evt_01JB7T9Q2RPREVIEW0000000";

/// What each value a gateway template can read means, by path.
const GATEWAY_FIELD_DESCRIPTIONS: &[(&str, &str)] = &[
    (
        "payment",
        "The payment the redirect or notification is about.",
    ),
    ("payment.id", "SendMock id of the payment."),
    (
        "payment.reference",
        "The gateway's main id: session, intent, order or transaction.",
    ),
    (
        "payment.amount_minor",
        "The amount in minor units, e.g. 1200 for 12.00.",
    ),
    (
        "payment.amount_major",
        "The amount with decimals as text, e.g. 12.00.",
    ),
    (
        "payment.currency",
        "ISO 4217 currency code, e.g. BDT or USD.",
    ),
    (
        "payment.status",
        "SendMock status, e.g. succeeded, failed or refunded.",
    ),
    (
        "payment.failure_code",
        "Why it failed or was declined, else empty.",
    ),
    ("payment.customer", "Who paid."),
    (
        "payment.customer.email",
        "The customer's email, may be empty.",
    ),
    (
        "payment.customer.name",
        "The customer's name, may be empty.",
    ),
    (
        "payment.customer.phone",
        "The customer's phone, may be empty.",
    ),
    (
        "payment.method",
        "What was paid with: card brand and last 4, or a masked wallet.",
    ),
    (
        "payment.provider_ids",
        "Every id the gateway gave the payment, by name.",
    ),
    (
        "payment.metadata",
        "Key / value pairs the app attached, e.g. order_id.",
    ),
    ("event", "The native event the notification is for."),
    ("event.id", "Event id, the same on every retry."),
    (
        "event.type",
        "SendMock's event name, e.g. payment.succeeded.",
    ),
    (
        "event.name",
        "This gateway's name for the event, from Event names.",
    ),
    ("event.created", "When it happened, Unix seconds."),
    ("redirect", "Where the checkout ended, for redirect fields."),
    ("redirect.outcome", "success, fail or cancel."),
    (
        "redirect.status",
        "This gateway's event name for the outcome (payment.succeeded, failed or canceled).",
    ),
    (
        "merchant",
        "The merchant credentials by name; secrets are masked in previews and real in deliveries.",
    ),
];

const GATEWAY_FUNCTIONS: &[TemplateHelperEntry] = &[(
    "stripe_signature",
    "stripe_signature(secret)",
    "The Stripe-Signature header: t=<timestamp>,v1=<HMAC-SHA256 of the timestamp and body>.",
    "t=1792914927,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd",
)];

/// The chosen payment, else the gateway's newest, else the newest of any gateway.
async fn find_preview_payment(
    operation_context: &OperationContext,
    gateway_key: &str,
    payment_id: Option<&str>,
) -> Result<Option<PaymentDetail>, OperationError> {
    if let Some(payment_id) = payment_id {
        return find_payment(operation_context, payment_id).await.map(Some);
    }
    for provider in [Some(gateway_key.to_owned()), None] {
        let filter = PaymentListFilter {
            provider,
            ..PaymentListFilter::default()
        };
        let newest_page = operation_context
            .payment_repository
            .list_payments(filter, None, 1)
            .await?;
        if let Some(stored_payment) = newest_page.payments.first() {
            return read_payment_document(stored_payment).map(Some);
        }
    }
    Ok(None)
}

/// The preview before any payment exists: the redirect method and the reference only.
fn build_empty_preview(gateway_fields: &PaymentGatewayFields) -> PaymentGatewayPreview {
    PaymentGatewayPreview {
        payment_id: None,
        redirect: GatewayPreviewRedirect {
            method: redirect_method_name(gateway_fields.redirect_method).to_owned(),
            url: String::new(),
            fields: BTreeMap::new(),
        },
        notification: None,
        problems: Vec::new(),
        reference: build_template_reference(
            &Value::Object(Map::new()),
            GATEWAY_FIELD_DESCRIPTIONS,
            GATEWAY_FUNCTIONS,
        ),
    }
}

fn render_preview(
    operation_context: &OperationContext,
    gateway_fields: &PaymentGatewayFields,
    payment: &PaymentDetail,
    render_options: &GatewayRenderOptions,
) -> PaymentGatewayPreview {
    let redirect_outcome = render_options.redirect_outcome;
    let template_context = build_gateway_context(gateway_fields, payment, render_options);
    let mut part_renderer = GatewayPartRenderer::new(
        operation_context,
        &template_context,
        render_options.timestamp_seconds,
    );
    let redirect_fields = part_renderer.render_redirect_fields(gateway_fields, redirect_outcome);
    let event_name = gateway_fields
        .event_names
        .get(&render_options.event_type)
        .cloned()
        .unwrap_or_default();
    let notification = (!event_name.trim().is_empty()).then(|| {
        let (headers, body) = part_renderer.render_notification(gateway_fields);
        GatewayPreviewNotification {
            event_name,
            headers,
            body,
        }
    });
    PaymentGatewayPreview {
        payment_id: Some(payment.summary.id.clone()),
        redirect: GatewayPreviewRedirect {
            method: redirect_method_name(gateway_fields.redirect_method).to_owned(),
            url: read_redirect_url(payment, redirect_outcome).map_or_else(
                || {
                    format!(
                        "http://localhost:8000/checkout/{}",
                        redirect_outcome.as_str()
                    )
                },
                str::to_owned,
            ),
            fields: redirect_fields,
        },
        notification,
        problems: part_renderer.problems,
        reference: build_template_reference(
            &template_context,
            GATEWAY_FIELD_DESCRIPTIONS,
            GATEWAY_FUNCTIONS,
        ),
    }
}

pub struct PreviewPaymentGatewayOperation;

impl Operation for PreviewPaymentGatewayOperation {
    type Input = PaymentGatewayPreviewRequest;
    type Output = PaymentGatewayPreview;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..gateway_definition(
                "postPaymentsGatewaysByGatewayKeyPreview",
                HttpMethod::Post,
                "/api/v1/payments/gateways/{gatewayKey}/preview",
                "Render a gateway's redirect and notification for a payment.",
                "sendmock payments gateways preview <gatewayKey>",
                "sendmock_payment_gateway_preview",
            )
        }
    }

    /// Renders a gateway, saved or not, with secrets masked and every template problem named by
    /// its part; nothing is stored or sent.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentGatewayPreviewRequest,
    ) -> Result<PaymentGatewayPreview, OperationError> {
        let mut gateway_fields = input.gateway;
        if let Ok(stored_gateway) =
            find_payment_gateway(operation_context, &input.gateway_key).await
        {
            gateway_fields.credentials = merge_credentials(
                &stored_gateway.fields.credentials,
                gateway_fields.credentials,
            );
        }
        let preview_payment = find_preview_payment(
            operation_context,
            &input.gateway_key,
            input.payment_id.as_deref(),
        )
        .await?;
        let Some(payment) = preview_payment else {
            return Ok(build_empty_preview(&gateway_fields));
        };
        let render_options = GatewayRenderOptions {
            event_type: input.event_type,
            redirect_outcome: input.redirect_outcome,
            event_id: PREVIEW_EVENT_ID.to_owned(),
            timestamp_seconds: operation_context.clock.now_unix_ms() / 1000,
            should_mask_secrets: true,
        };
        Ok(render_preview(
            operation_context,
            &gateway_fields,
            &payment,
            &render_options,
        ))
    }
}
