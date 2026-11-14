use super::checkout_payment_run::to_wire_name;
use super::payment_change::PaymentChange;
use super::payment_method_views::DeclineReason;
use super::payment_notification::refresh_notification_statuses;
use super::payment_settlement::{list_simulate_actions, read_refundable_minor};
use super::payment_simulate_views::{
    DisputeOutcome, PaymentSimulateAction, PaymentSimulateRequest,
};
use super::payment_views::PaymentDetail;
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

fn refuse_refund(message: &str) -> OperationError {
    OperationError::Unprocessable {
        code: "validation_failed",
        message: message.to_owned(),
    }
}

/// The amount a refund takes: the one asked for, or all that is left; never more.
fn read_refund_minor(
    payment: &PaymentDetail,
    refund_amount_minor: Option<u64>,
) -> Result<u64, OperationError> {
    let refundable_minor = read_refundable_minor(payment);
    let refund_minor = refund_amount_minor.unwrap_or(refundable_minor);
    if refund_minor == 0 {
        return Err(refuse_refund("Enter an amount above zero"));
    }
    if refund_minor > refundable_minor {
        return Err(refuse_refund("That is more than is left to refund"));
    }
    Ok(refund_minor)
}

/// Moves the payment on as the gateway would, noting the events the step fires.
fn apply_simulate_action(
    payment_change: &mut PaymentChange<'_>,
    input: &PaymentSimulateRequest,
) -> Result<(), OperationError> {
    match input.action {
        PaymentSimulateAction::Succeed => payment_change.succeed(),
        PaymentSimulateAction::Capture => {
            let amount_minor = payment_change.payment.summary.amount_minor;
            payment_change.capture(amount_minor);
        }
        PaymentSimulateAction::Decline => payment_change.decline(&to_wire_name(
            input
                .decline_reason
                .unwrap_or(DeclineReason::GenericDecline),
        )),
        PaymentSimulateAction::Expire => payment_change.expire_checkout(),
        PaymentSimulateAction::Void => payment_change.void_authorization(),
        PaymentSimulateAction::Refund => {
            let refund_minor =
                read_refund_minor(&payment_change.payment, input.refund_amount_minor)?;
            payment_change.refund(refund_minor);
        }
        PaymentSimulateAction::Dispute => payment_change.open_dispute(),
        PaymentSimulateAction::AnswerDispute => {
            let dispute_evidence = input
                .dispute_evidence
                .as_deref()
                .map(str::trim)
                .filter(|evidence| !evidence.is_empty())
                .unwrap_or("Evidence sent");
            payment_change.answer_dispute(dispute_evidence);
        }
        PaymentSimulateAction::ResolveDispute => {
            payment_change.resolve_dispute(input.dispute_outcome.unwrap_or(DisputeOutcome::Won));
        }
    }
    Ok(())
}

pub struct SimulatePaymentOperation;

impl Operation for SimulatePaymentOperation {
    type Input = PaymentSimulateRequest;
    type Output = PaymentDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postPaymentsByPaymentIdSimulate",
            method: HttpMethod::Post,
            path: "/api/v1/payments/{paymentId}/simulate",
            summary: "Move the payment on: capture, refund, dispute, fail.",
            cli_usage: "sendmock payments simulate <paymentId> <action>",
            mcp_tool: "sendmock_payment_simulate",
            cli_flag_names: &[("webhook_endpoint_ids", "webhook")],
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Runs only what the payment's status allows (`409` otherwise), refunds no more than
    /// is left (`422`), and sends the gateway's notification for each event (PY-09.3).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentSimulateRequest,
    ) -> Result<PaymentDetail, OperationError> {
        let operation_context = &input.webhook_choice.apply_to(operation_context).await?;
        let mut payment_change = PaymentChange::load(operation_context, &input.payment_id).await?;
        if !list_simulate_actions(&payment_change.payment).contains(&input.action) {
            return Err(OperationError::Conflict {
                code: "action_not_allowed",
                message: format!(
                    "A {} payment cannot do {}",
                    payment_change
                        .payment
                        .summary
                        .status
                        .as_str()
                        .replace('_', " "),
                    to_wire_name(input.action).replace('_', " ")
                ),
            });
        }
        apply_simulate_action(&mut payment_change, &input)?;
        let mut payment = payment_change.save().await?;
        refresh_notification_statuses(operation_context, &mut payment).await?;
        Ok(payment)
    }
}
