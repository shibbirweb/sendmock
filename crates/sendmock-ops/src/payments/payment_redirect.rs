use std::collections::BTreeMap;

use super::gateway_template_rendering::{
    GatewayPartRenderer, GatewayRenderOptions, RedirectOutcome, build_gateway_context,
    redirect_method_name,
};
use super::payment_gateway_views::{PaymentGatewayFields, RedirectMethod};
use super::payment_views::{PaymentDetail, PaymentRedirect};
use crate::OperationContext;

pub fn read_redirect_url(
    payment: &PaymentDetail,
    redirect_outcome: RedirectOutcome,
) -> Option<&str> {
    match redirect_outcome {
        RedirectOutcome::Success => payment.success_url.as_deref(),
        RedirectOutcome::Fail => payment.fail_url.as_deref(),
        RedirectOutcome::Cancel => payment.cancel_url.as_deref(),
    }
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
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let (redirect_method, fields) = match gateway_fields {
        Some(gateway_fields) => {
            let render_options = GatewayRenderOptions {
                event_type: "payment.succeeded".to_owned(),
                redirect_outcome,
                event_id: String::new(),
                timestamp_seconds: now_unix_ms / 1000,
                should_mask_secrets: false,
            };
            let template_context = build_gateway_context(gateway_fields, payment, &render_options);
            let mut part_renderer = GatewayPartRenderer::new(
                operation_context,
                &template_context,
                render_options.timestamp_seconds,
            );
            let fields = part_renderer.render_redirect_fields(gateway_fields, redirect_outcome);
            (gateway_fields.redirect_method, fields)
        }
        None => (RedirectMethod::Get, BTreeMap::new()),
    };
    Some(PaymentRedirect {
        outcome: redirect_outcome.as_str().to_owned(),
        url: redirect_url.to_owned(),
        method: redirect_method_name(redirect_method).to_owned(),
        fields,
        redirected_at: sendmock_core::format_rfc3339(now_unix_ms),
    })
}
