use super::checkout_completion_views::{CheckoutAction, CheckoutCompleteRequest};
use super::checkout_operations::{build_checkout_session, read_checkout_state};
use super::checkout_payment_run::{pay_checkout, to_wire_name};
use super::checkout_views::{CheckoutSession, CheckoutState};
use super::payment_change::PaymentChange;
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

/// What the page can do in each state; a closed checkout allows nothing.
fn is_action_allowed(checkout_state: CheckoutState, checkout_action: CheckoutAction) -> bool {
    match checkout_state {
        CheckoutState::Open => matches!(
            checkout_action,
            CheckoutAction::Pay
                | CheckoutAction::Decline
                | CheckoutAction::Cancel
                | CheckoutAction::Delay
                | CheckoutAction::RequireThreeDs
        ),
        CheckoutState::RequiresThreeDs => matches!(
            checkout_action,
            CheckoutAction::ThreeDsApprove | CheckoutAction::ThreeDsFail | CheckoutAction::Cancel
        ),
        _ => false,
    }
}

pub struct CompleteCheckoutOperation;

impl Operation for CompleteCheckoutOperation {
    type Input = CheckoutCompleteRequest;
    type Output = CheckoutSession;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postCheckoutSessionsBySessionIdComplete",
            method: HttpMethod::Post,
            path: "/api/v1/checkout-sessions/{sessionId}/complete",
            summary: "Pay, decline or cancel from the checkout page.",
            cli_usage: "sendmock payments checkout complete <sessionId> <action>",
            mcp_tool: "sendmock_checkout_complete",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// The page's actions, never written to the API request log, so a card number typed by
    /// mistake is kept nowhere.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: CheckoutCompleteRequest,
    ) -> Result<CheckoutSession, OperationError> {
        let mut payment_change = PaymentChange::load(operation_context, &input.session_id).await?;
        let checkout_state = read_checkout_state(&payment_change.payment);
        if !is_action_allowed(checkout_state, input.action) {
            return Err(OperationError::Conflict {
                code: "checkout_closed",
                message: "This checkout is closed and cannot be paid again".to_owned(),
            });
        }
        match input.action {
            CheckoutAction::Pay => {
                pay_checkout(&mut payment_change, operation_context, &input).await?;
            }
            CheckoutAction::Decline => {
                let decline_reason = input
                    .decline_reason
                    .map_or_else(|| "generic_decline".to_owned(), to_wire_name);
                payment_change.decline(&decline_reason);
            }
            CheckoutAction::Cancel => payment_change.cancel_checkout(),
            CheckoutAction::Delay => payment_change.delay(),
            CheckoutAction::RequireThreeDs => payment_change.show_three_ds(),
            CheckoutAction::ThreeDsApprove => {
                payment_change.add_timeline("three_ds", "3-D Secure approved");
                payment_change.succeed();
            }
            CheckoutAction::ThreeDsFail => {
                payment_change.add_timeline("three_ds", "3-D Secure failed");
                payment_change.decline("authentication_failed");
            }
        }
        let payment = payment_change.save().await?;
        build_checkout_session(operation_context, payment).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_an_open_or_three_ds_checkout_takes_actions() {
        assert!(is_action_allowed(CheckoutState::Open, CheckoutAction::Pay));
        assert!(!is_action_allowed(
            CheckoutState::Open,
            CheckoutAction::ThreeDsApprove
        ));
        assert!(is_action_allowed(
            CheckoutState::RequiresThreeDs,
            CheckoutAction::Cancel
        ));
        assert!(!is_action_allowed(
            CheckoutState::RequiresThreeDs,
            CheckoutAction::Pay
        ));
        assert!(!is_action_allowed(
            CheckoutState::Completed,
            CheckoutAction::Pay
        ));
        assert!(!is_action_allowed(
            CheckoutState::Pending,
            CheckoutAction::Cancel
        ));
    }
}
