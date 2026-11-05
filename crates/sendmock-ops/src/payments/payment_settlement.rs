use super::payment_change::PaymentChange;
use super::payment_simulate_views::{DisputeOutcome, PaymentSimulateAction};
use super::payment_views::{PaymentDetail, PaymentDispute, PaymentStatus};
use crate::AppEventType;

/// What Simulate allows a payment in its status, as the Simulate menu offers it (PY-09.3).
pub fn list_simulate_actions(payment: &PaymentDetail) -> &'static [PaymentSimulateAction] {
    use PaymentSimulateAction::{
        Capture, Decline, Dispute, Expire, Refund, ResolveDispute, Succeed, Void,
    };
    match payment.summary.status {
        PaymentStatus::RequiresPayment | PaymentStatus::RequiresAction => {
            if payment.checkout_url.is_some() {
                &[Succeed, Decline, Expire]
            } else {
                &[Succeed, Decline]
            }
        }
        PaymentStatus::Authorized => &[Capture, Void],
        PaymentStatus::Succeeded | PaymentStatus::PartiallyRefunded => &[Refund, Dispute],
        PaymentStatus::Disputed => &[ResolveDispute],
        PaymentStatus::Failed | PaymentStatus::Canceled | PaymentStatus::Refunded => &[],
    }
}

/// What is left to refund: captured minus refunded.
pub fn read_refundable_minor(payment: &PaymentDetail) -> u64 {
    payment
        .captured_minor
        .saturating_sub(payment.summary.refunded_minor)
}

/// The steps after the checkout: capture, void, refund, expiry and the dispute's end.
impl PaymentChange<'_> {
    /// An authorized payment captured in whole or in part; the rest is released.
    pub fn capture(&mut self, capture_minor: u64) {
        self.payment.summary.status = PaymentStatus::Succeeded;
        self.payment.captured_minor = capture_minor.min(self.payment.summary.amount_minor);
        let captured_text = format!(
            "Captured {}",
            self.format_money(self.payment.captured_minor)
        );
        self.add_timeline("captured", captured_text);
        self.fire_event(AppEventType::PaymentSucceeded);
    }

    pub fn void_authorization(&mut self) {
        self.payment.summary.status = PaymentStatus::Canceled;
        self.add_timeline("canceled", "Authorization voided");
        self.fire_event(AppEventType::PaymentCanceled);
    }

    /// The merchant cancels a payment that is not paid yet; its page closes.
    pub fn cancel_by_merchant(&mut self) {
        self.payment.summary.status = PaymentStatus::Canceled;
        self.payment.checkout_url = None;
        self.add_timeline("canceled", "Canceled by the merchant");
        self.fire_event(AppEventType::PaymentCanceled);
    }

    /// The checkout page closes unpaid; the customer is not sent anywhere.
    pub fn expire_checkout(&mut self) {
        self.payment.summary.status = PaymentStatus::Canceled;
        self.payment.summary.failure_code = Some("expired".to_owned());
        self.payment.checkout_url = None;
        self.add_timeline("expired", "The checkout session expired");
        self.fire_event(AppEventType::CheckoutExpired);
    }

    /// Refunds part or all of what is left; the payment is refunded once nothing is left.
    pub fn refund(&mut self, refund_minor: u64) {
        self.payment.summary.refunded_minor += refund_minor;
        let is_full_refund = self.payment.summary.refunded_minor >= self.payment.captured_minor;
        self.payment.summary.status = if is_full_refund {
            PaymentStatus::Refunded
        } else {
            PaymentStatus::PartiallyRefunded
        };
        let refunded_text = format!("Refunded {}", self.format_money(refund_minor));
        self.add_timeline("refunded", refunded_text);
        self.fire_event(if is_full_refund {
            AppEventType::PaymentRefunded
        } else {
            AppEventType::PaymentPartiallyRefunded
        });
    }

    /// A won dispute keeps the money; a lost one returns all of it to the customer.
    pub fn resolve_dispute(&mut self, dispute_outcome: DisputeOutcome) {
        let is_won = dispute_outcome == DisputeOutcome::Won;
        let dispute_reason = self
            .payment
            .dispute
            .as_ref()
            .map_or_else(|| "fraudulent".to_owned(), |dispute| dispute.reason.clone());
        self.payment.dispute = Some(PaymentDispute {
            status: if is_won { "won" } else { "lost" }.to_owned(),
            reason: dispute_reason,
        });
        self.payment.summary.status = if !is_won {
            self.payment.summary.refunded_minor = self.payment.captured_minor;
            PaymentStatus::Refunded
        } else if self.payment.summary.refunded_minor > 0 {
            PaymentStatus::PartiallyRefunded
        } else {
            PaymentStatus::Succeeded
        };
        self.add_timeline(
            "dispute_closed",
            if is_won {
                "Dispute won"
            } else {
                "Dispute lost"
            },
        );
        self.fire_event(AppEventType::PaymentDisputeClosed);
    }
}
