use super::payment_change::PaymentChange;
use super::payment_notification::refresh_notification_statuses;
use super::payment_views::{PaymentDetail, PaymentReference};
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

fn nothing_to_resend(message: String) -> OperationError {
    OperationError::Conflict {
        code: "nothing_to_resend",
        message,
    }
}

pub struct NotifyPaymentOperation;

impl Operation for NotifyPaymentOperation {
    type Input = PaymentReference;
    type Output = PaymentDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postPaymentsByPaymentIdNotify",
            method: HttpMethod::Post,
            path: "/api/v1/payments/{paymentId}/notify",
            summary: "Send the payment's notification (IPN or webhook) again.",
            cli_usage: "sendmock payments notify <paymentId>",
            mcp_tool: "sendmock_payment_notify",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Renders the gateway's notification for the payment's last notified event again and
    /// queues it as a new delivery, as a provider's "resend IPN" does (PY-08.3).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentReference,
    ) -> Result<PaymentDetail, OperationError> {
        let mut payment_change = PaymentChange::load(operation_context, &input.payment_id).await?;
        let Some(last_event_type) = payment_change
            .payment
            .notifications
            .last()
            .map(|payment_notification| payment_notification.event_type.clone())
        else {
            return Err(nothing_to_resend(
                "No notification was sent for this payment yet".to_owned(),
            ));
        };
        if !payment_change.resend_notification(&last_event_type).await? {
            return Err(nothing_to_resend(format!(
                "The gateway has no notification endpoint, or sends nothing for {last_event_type}"
            )));
        }
        let mut payment = payment_change.save().await?;
        refresh_notification_statuses(operation_context, &mut payment).await?;
        Ok(payment)
    }
}
