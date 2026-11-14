use sendmock_payments::format_major_amount;
use serde_json::{Value, json};

use super::payment_catalogue::find_payment;
use super::payment_views::{PaymentDetail, PaymentStatus};
use crate::{AppEvent, OperationContext, OperationError};

/// What a payment event carries as `data`, for webhook rules and the payment templates: the
/// payment without its timeline and notifications, plus `amount_major` ("12.00").
pub fn build_payment_event_data(payment: &PaymentDetail) -> Value {
    let mut event_data = serde_json::to_value(payment).unwrap_or(Value::Null);
    if let Value::Object(event_fields) = &mut event_data {
        event_fields.remove("timeline");
        event_fields.remove("notifications");
        event_fields.insert(
            "amount_major".to_owned(),
            Value::from(format_major_amount(
                payment.summary.amount_minor,
                &payment.summary.currency,
            )),
        );
    }
    event_data
}

/// The event a payment's latest state stands for.
fn read_payment_event_type(payment_status: PaymentStatus) -> &'static str {
    match payment_status {
        PaymentStatus::RequiresPayment | PaymentStatus::RequiresAction => "payment.created",
        PaymentStatus::Authorized => "payment.authorized",
        PaymentStatus::Succeeded => "payment.succeeded",
        PaymentStatus::Failed => "payment.failed",
        PaymentStatus::Canceled => "payment.canceled",
        PaymentStatus::Refunded => "payment.refunded",
        PaymentStatus::PartiallyRefunded => "payment.partially_refunded",
        PaymentStatus::Disputed => "payment.dispute_opened",
    }
}

/// A stored payment as the event its latest state stands for, and how a preview names it.
pub async fn load_payment_event(
    operation_context: &OperationContext,
    payment_id: &str,
) -> Result<(AppEvent, String), OperationError> {
    let payment = find_payment(operation_context, payment_id).await?;
    let rendered_against = format!(
        "{} {}",
        payment.summary.provider_name, payment.summary.provider_reference
    );
    let payment_event = AppEvent {
        id: format!("evt_{}", payment.summary.id),
        event_type: read_payment_event_type(payment.summary.status).to_owned(),
        created_at: payment.summary.created_at.clone(),
        data: build_payment_event_data(&payment),
    };
    Ok((payment_event, rendered_against))
}

/// A paid Stripe checkout, for previews of payment events when no payment is picked; the
/// mock's sample is the same.
pub fn build_sample_payment_event_data() -> Value {
    json!({
        "id": "01JB7T9Q2R5W8X3Y6Z1A4B7C9D",
        "provider": "stripe",
        "provider_name": "Stripe",
        "provider_reference": "cs_test_01JB7T9Q2R5W8X3Y6Z1A4B7C9D",
        "amount_minor": 1200,
        "amount_major": "12.00",
        "currency": "USD",
        "status": "succeeded",
        "customer_email": "lena@example.com",
        "customer_name": "Lena Vogel",
        "failure_code": null,
        "refunded_minor": 0,
        "created_at": "2026-01-01T09:00:00Z",
        "provider_ids": {
            "checkout_session": "cs_test_01JB7T9Q2R5W8X3Y6Z1A4B7C9D",
            "payment_intent": "pi_01JB7T9Q2R5W8X3Y6Z1A4B7C9D",
        },
        "customer_phone": null,
        "method": {
            "kind": "card",
            "brand": "visa",
            "last4": "4242",
            "exp_month": 12,
            "exp_year": 2030,
        },
        "line_items": [{ "name": "Test order", "quantity": 1, "unit_amount_minor": 1200 }],
        "metadata": { "order_id": "1001" },
        "success_url": "http://localhost:8000/checkout/success",
        "fail_url": "http://localhost:8000/checkout/fail",
        "cancel_url": "http://localhost:8000/checkout/cancel",
        "checkout_url": null,
        "redirect": null,
        "captured_minor": 1200,
        "method_key": "card",
        "dispute": null,
    })
}
