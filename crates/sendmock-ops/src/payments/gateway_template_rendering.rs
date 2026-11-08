use std::collections::BTreeMap;

use sendmock_core::{
    StandardTemplateFunctions, TemplateEscape, TemplateProblemSeverity, TemplateRenderMode,
    render_template_in_mode,
};
use sendmock_payments::format_major_amount;
use serde_json::{Map, Value, json};

use super::gateway_template_functions::GatewayTemplateFunctions;
use super::payment_gateway_preview_views::GatewayTemplateProblem;
use super::payment_gateway_views::{
    NotificationContentType, PaymentGatewayFields, RedirectFieldSendOn, RedirectMethod,
};
use super::payment_views::PaymentDetail;
use crate::OperationContext;
use crate::message_providers::mask_secret_value;

/// Which way the customer leaves the checkout page.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
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
    pub fn event_type(self) -> &'static str {
        match self {
            Self::Success => "payment.succeeded",
            Self::Fail => "payment.failed",
            Self::Cancel => "payment.canceled",
        }
    }
}

/// What one render is for: the event, the redirect and whether secrets are masked.
pub struct GatewayRenderOptions {
    pub event_type: String,
    pub redirect_outcome: RedirectOutcome,
    pub event_id: String,
    pub timestamp_seconds: i64,
    /// Previews mask secret credentials; real redirects and deliveries use them.
    pub should_mask_secrets: bool,
    /// The provider's own object the event is about, read as `event.object`.
    pub event_object: Value,
}

/// The merchant credentials by name, secrets masked when asked.
fn build_merchant_values(
    gateway_fields: &PaymentGatewayFields,
    should_mask_secrets: bool,
) -> Map<String, Value> {
    gateway_fields
        .credentials
        .iter()
        .map(|credential| {
            let shown_value = if should_mask_secrets && credential.is_secret {
                mask_secret_value(&credential.value)
            } else {
                credential.value.clone()
            };
            (credential.name.clone(), Value::from(shown_value))
        })
        .collect()
}

/// What a gateway's templates read: `payment`, `event`, `redirect` and `merchant`.
pub fn build_gateway_context(
    gateway_fields: &PaymentGatewayFields,
    payment: &PaymentDetail,
    render_options: &GatewayRenderOptions,
) -> Value {
    let read_event_name = |event_type: &str| {
        gateway_fields
            .event_names
            .get(event_type)
            .cloned()
            .unwrap_or_default()
    };
    let merchant = build_merchant_values(gateway_fields, render_options.should_mask_secrets);
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
            "id": render_options.event_id,
            "type": render_options.event_type,
            "name": read_event_name(&render_options.event_type),
            "created": render_options.timestamp_seconds,
            "object": render_options.event_object,
        },
        "redirect": {
            "outcome": render_options.redirect_outcome.as_str(),
            "status": read_event_name(render_options.redirect_outcome.event_type()),
        },
        "merchant": merchant,
    })
}

/// Renders the gateway's templates, noting each problem with the part it is in.
pub struct GatewayPartRenderer<'render> {
    pub template_context: &'render Value,
    pub template_functions: GatewayTemplateFunctions,
    pub problems: Vec<GatewayTemplateProblem>,
}

impl<'render> GatewayPartRenderer<'render> {
    pub fn new(
        operation_context: &OperationContext,
        template_context: &'render Value,
        timestamp_seconds: i64,
    ) -> Self {
        Self {
            template_context,
            template_functions: GatewayTemplateFunctions {
                standard_functions: StandardTemplateFunctions::new(
                    operation_context.clock.clone(),
                    operation_context.random_source.clone(),
                ),
                timestamp_seconds,
                signed_body: String::new(),
            },
            problems: Vec::new(),
        }
    }

    pub fn render_part(
        &mut self,
        part_name: String,
        template_text: &str,
        escape: TemplateEscape,
    ) -> String {
        let rendered_part = render_template_in_mode(
            template_text,
            self.template_context,
            &self.template_functions,
            escape,
            TemplateRenderMode::Lenient,
        );
        for template_problem in rendered_part.problems {
            self.problems.push(GatewayTemplateProblem {
                part: part_name.clone(),
                message: template_problem.message,
                severity: match template_problem.severity {
                    TemplateProblemSeverity::Error => "error",
                    TemplateProblemSeverity::Warning => "warning",
                }
                .to_owned(),
            });
        }
        rendered_part.text
    }

    /// The redirect fields for one outcome; success-only fields are left out otherwise.
    pub fn render_redirect_fields(
        &mut self,
        gateway_fields: &PaymentGatewayFields,
        redirect_outcome: RedirectOutcome,
    ) -> BTreeMap<String, String> {
        gateway_fields
            .redirect_fields
            .iter()
            .filter(|redirect_field| {
                redirect_field.send_on == RedirectFieldSendOn::Always
                    || redirect_outcome == RedirectOutcome::Success
            })
            .map(|redirect_field| {
                let field_value = self.render_part(
                    format!("Redirect field {}", redirect_field.name),
                    &redirect_field.template,
                    TemplateEscape::None,
                );
                (redirect_field.name.clone(), field_value)
            })
            .collect()
    }

    /// The notification's body, then its headers, which may sign the body; `content-type`
    /// first, header names in lowercase.
    pub fn render_notification(
        &mut self,
        gateway_fields: &PaymentGatewayFields,
    ) -> (BTreeMap<String, String>, String) {
        let (content_type, body_escape) = match gateway_fields.notification_content_type {
            NotificationContentType::Json => ("application/json", TemplateEscape::JsonString),
            NotificationContentType::Form => {
                ("application/x-www-form-urlencoded", TemplateEscape::None)
            }
        };
        let body = self.render_part(
            "Notification body".to_owned(),
            &gateway_fields.notification_body,
            body_escape,
        );
        self.template_functions.signed_body.clone_from(&body);
        let mut headers = BTreeMap::from([("content-type".to_owned(), content_type.to_owned())]);
        for header_template in &gateway_fields.notification_headers {
            let header_value = self.render_part(
                format!("Header {}", header_template.name),
                &header_template.template,
                TemplateEscape::None,
            );
            headers.insert(header_template.name.to_lowercase(), header_value);
        }
        (headers, body)
    }
}

pub fn redirect_method_name(redirect_method: RedirectMethod) -> &'static str {
    match redirect_method {
        RedirectMethod::Get => "GET",
        RedirectMethod::Post => "POST",
    }
}

/// Template errors that refuse a save (unknown functions or filters, unbalanced braces), found
/// without a payment so every template is checked.
pub fn find_gateway_template_errors(
    operation_context: &OperationContext,
    gateway_fields: &PaymentGatewayFields,
) -> Vec<GatewayTemplateProblem> {
    let empty_context = Value::Object(Map::new());
    let mut part_renderer = GatewayPartRenderer::new(operation_context, &empty_context, 0);
    for redirect_field in &gateway_fields.redirect_fields {
        part_renderer.render_part(
            format!("Redirect field {}", redirect_field.name),
            &redirect_field.template,
            TemplateEscape::None,
        );
    }
    part_renderer.render_notification(gateway_fields);
    part_renderer
        .problems
        .into_iter()
        .filter(|template_problem| template_problem.severity == "error")
        .collect()
}
