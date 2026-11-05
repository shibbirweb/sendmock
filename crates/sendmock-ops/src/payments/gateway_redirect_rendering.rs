use std::collections::BTreeMap;

use sendmock_core::{
    StandardTemplateFunctions, TemplateEscape, TemplateRenderMode, render_template_in_mode,
};
use sendmock_payments::format_major_amount;
use serde_json::{Map, Value, json};

use super::payment_gateway_views::{PaymentGatewayFields, RedirectFieldSendOn, RedirectMethod};
use super::payment_views::{PaymentDetail, PaymentRedirect};
use crate::OperationContext;

/// Which way the customer leaves the checkout page.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RedirectOutcome {
    Success,
    Fail,
    Cancel,
}

impl RedirectOutcome {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Success => "success",
            Self::Fail => "fail",
            Self::Cancel => "cancel",
        }
    }

    /// The native event the outcome stands for, read by `redirect.status`.
    fn event_type(self) -> &'static str {
        match self {
            Self::Success => "payment.succeeded",
            Self::Fail => "payment.failed",
            Self::Cancel => "payment.canceled",
        }
    }
}

/// What a gateway's templates read: `payment`, `event`, `redirect` and `merchant`.
pub fn build_gateway_context(
    gateway_fields: &PaymentGatewayFields,
    payment: &PaymentDetail,
    event_type: &str,
    redirect_outcome: RedirectOutcome,
    timestamp_seconds: i64,
) -> Value {
    let read_event_name = |event_type: &str| {
        gateway_fields
            .event_names
            .get(event_type)
            .cloned()
            .unwrap_or_default()
    };
    let merchant: Map<String, Value> = gateway_fields
        .credentials
        .iter()
        .map(|credential| {
            (
                credential.name.clone(),
                Value::from(credential.value.clone()),
            )
        })
        .collect();
    let summary = &payment.summary;
    json!({
        "payment": {
            "id": summary.id,
            "reference": summary.provider_reference,
            "amount_minor": summary.amount_minor,
            "amount_major": format_major_amount(summary.amount_minor, &summary.currency),
            "currency": summary.currency,
            "status": summary.status.as_str(),
            "failure_code": summary.failure_code,
            "customer": {
                "email": summary.customer_email,
                "name": summary.customer_name,
                "phone": payment.customer_phone,
            },
            "method": payment.method,
            "provider_ids": payment.provider_ids,
            "metadata": payment.metadata,
        },
        "event": {
            "id": "",
            "type": event_type,
            "name": read_event_name(event_type),
            "created": timestamp_seconds,
        },
        "redirect": {
            "outcome": redirect_outcome.as_str(),
            "status": read_event_name(redirect_outcome.event_type()),
        },
        "merchant": merchant,
    })
}

fn read_redirect_url(payment: &PaymentDetail, redirect_outcome: RedirectOutcome) -> Option<&str> {
    match redirect_outcome {
        RedirectOutcome::Success => payment.success_url.as_deref(),
        RedirectOutcome::Fail => payment.fail_url.as_deref(),
        RedirectOutcome::Cancel => payment.cancel_url.as_deref(),
    }
}

/// The gateway's redirect fields for one outcome, success-only fields left out otherwise.
fn render_redirect_fields(
    operation_context: &OperationContext,
    gateway_fields: &PaymentGatewayFields,
    payment: &PaymentDetail,
    redirect_outcome: RedirectOutcome,
) -> BTreeMap<String, String> {
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let template_context = build_gateway_context(
        gateway_fields,
        payment,
        RedirectOutcome::Success.event_type(),
        redirect_outcome,
        now_unix_ms / 1000,
    );
    let template_functions = StandardTemplateFunctions::new(
        operation_context.clock.clone(),
        operation_context.random_source.clone(),
    );
    gateway_fields
        .redirect_fields
        .iter()
        .filter(|redirect_field| {
            redirect_field.send_on == RedirectFieldSendOn::Always
                || redirect_outcome == RedirectOutcome::Success
        })
        .map(|redirect_field| {
            let rendered_field = render_template_in_mode(
                &redirect_field.template,
                &template_context,
                &template_functions,
                TemplateEscape::None,
                TemplateRenderMode::Lenient,
            );
            (redirect_field.name.clone(), rendered_field.text)
        })
        .collect()
}

/// Where the browser goes after the checkout, with the fields the gateway sends back; none
/// when the app set no URL for the outcome. A deleted gateway sends no fields.
pub fn build_payment_redirect(
    operation_context: &OperationContext,
    gateway_fields: Option<&PaymentGatewayFields>,
    payment: &PaymentDetail,
    redirect_outcome: RedirectOutcome,
) -> Option<PaymentRedirect> {
    let redirect_url = read_redirect_url(payment, redirect_outcome)?;
    let (method, fields) = match gateway_fields {
        Some(gateway_fields) => (
            gateway_fields.redirect_method,
            render_redirect_fields(operation_context, gateway_fields, payment, redirect_outcome),
        ),
        None => (RedirectMethod::Get, BTreeMap::new()),
    };
    Some(PaymentRedirect {
        outcome: redirect_outcome.as_str().to_owned(),
        url: redirect_url.to_owned(),
        method: match method {
            RedirectMethod::Get => "GET".to_owned(),
            RedirectMethod::Post => "POST".to_owned(),
        },
        fields,
        redirected_at: sendmock_core::format_rfc3339(operation_context.clock.now_unix_ms()),
    })
}
