use serde_json::{Value, json};

use super::custom_gateway_call::{CustomGatewayAnswer, CustomGatewayCall, CustomGatewayRefusal};
use crate::OperationError;
use crate::payments::{
    GatewayPartRenderer, GatewayRenderOptions, PaymentDetail, PaymentStatus, build_gateway_context,
    read_redirect_outcome,
};

/// The event the payment's status stands for, as its notification would name it.
fn read_status_event_type(payment: &PaymentDetail) -> &'static str {
    match payment.summary.status {
        PaymentStatus::RequiresPayment | PaymentStatus::RequiresAction => "payment.created",
        PaymentStatus::Authorized => "payment.authorized",
        PaymentStatus::Succeeded => "payment.succeeded",
        PaymentStatus::Failed => "payment.failed",
        PaymentStatus::Canceled if payment.summary.failure_code.as_deref() == Some("expired") => {
            "checkout.expired"
        }
        PaymentStatus::Canceled => "payment.canceled",
        PaymentStatus::Refunded => "payment.refunded",
        PaymentStatus::PartiallyRefunded => "payment.partially_refunded",
        PaymentStatus::Disputed => "payment.dispute_opened",
    }
}

fn build_render_options(
    custom_gateway_call: &CustomGatewayCall<'_>,
    event_type: &str,
) -> GatewayRenderOptions {
    let operation_context = custom_gateway_call.operation_context;
    GatewayRenderOptions {
        event_type: event_type.to_owned(),
        redirect_outcome: read_redirect_outcome(event_type),
        event_id: format!("evt_{}", operation_context.id_generator.generate_id()),
        timestamp_seconds: operation_context.clock.now_unix_ms().div_euclid(1_000),
        should_mask_secrets: false,
        event_object: Value::Null,
    }
}

/// `GET /providers/<gatewayKey>/payments/{paymentReference}`: the gateway's notification body
/// for the payment as it is now, so validation says what the notification says.
pub async fn validate_custom_payment(
    custom_gateway_call: &CustomGatewayCall<'_>,
    payment_reference: &str,
) -> Result<CustomGatewayAnswer, OperationError> {
    let Some(payment) = custom_gateway_call.find_payment(payment_reference).await? else {
        let refusal = CustomGatewayRefusal {
            status: 404,
            code: "payment_not_found",
            message: format!("No payment with the id or reference {payment_reference}"),
            field: None,
        };
        return Ok(refusal.to_answer());
    };
    let gateway_fields = custom_gateway_call.gateway_fields;
    let render_options =
        build_render_options(custom_gateway_call, read_status_event_type(&payment));
    let template_context = build_gateway_context(gateway_fields, &payment, &render_options);
    let mut part_renderer = GatewayPartRenderer::new(
        custom_gateway_call.operation_context,
        &template_context,
        render_options.timestamp_seconds,
    );
    let (headers, body) = part_renderer.render_notification(gateway_fields);
    let template_errors: Vec<_> = part_renderer
        .problems
        .iter()
        .filter(|problem| problem.severity == "error")
        .collect();
    if !template_errors.is_empty() {
        return Ok(CustomGatewayAnswer::json(
            500,
            &json!({
                "error": {
                    "code": "template_error",
                    "message": "The gateway's notification body could not be rendered",
                    "field": null,
                    "problems": template_errors,
                },
            }),
        ));
    }
    Ok(CustomGatewayAnswer {
        status: 200,
        content_type: headers
            .get("content-type")
            .cloned()
            .unwrap_or_else(|| "application/json".to_owned()),
        body,
    })
}
