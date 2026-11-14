use sendmock_payments::format_major_amount;
use sendmock_store::PaymentProviderObjectRecord;

use super::gateway_template_rendering::RedirectOutcome;
use super::payment_catalogue::{add_timeline_event, find_payment, save_payment};
use super::payment_event_data::build_payment_event_data;
use super::payment_gateway_catalogue::find_payment_gateway;
use super::payment_gateway_views::PaymentGatewayFields;
use super::payment_notification::queue_payment_notification;
use super::payment_redirect::build_payment_redirect;
use super::payment_views::{
    PaymentCaptureMethod, PaymentDetail, PaymentDispute, PaymentInstrument, PaymentStatus,
};
use crate::settings::PaymentOutcomeProfile;
use crate::{AppEventType, OperationContext, OperationError, publish_event};

/// A payment being moved through its states: each step changes the payment and notes the
/// events it fires; `save` stores it and then publishes them.
pub struct PaymentChange<'context> {
    operation_context: &'context OperationContext,
    /// None when the gateway was deleted: redirects then carry no fields.
    gateway_fields: Option<PaymentGatewayFields>,
    pub payment: PaymentDetail,
    fired_events: Vec<AppEventType>,
    /// A provider adapter's own objects, stored with the payment once it is saved.
    kept_provider_objects: Vec<PaymentProviderObjectRecord>,
}

impl<'context> PaymentChange<'context> {
    pub async fn start(
        operation_context: &'context OperationContext,
        payment: PaymentDetail,
        fired_events: Vec<AppEventType>,
    ) -> Self {
        let gateway_fields = find_payment_gateway(operation_context, &payment.summary.provider)
            .await
            .ok()
            .map(|payment_gateway| payment_gateway.fields);
        Self {
            operation_context,
            gateway_fields,
            payment,
            fired_events,
            kept_provider_objects: Vec::new(),
        }
    }

    pub fn operation_context(&self) -> &'context OperationContext {
        self.operation_context
    }

    /// Stores the object with the payment; the notifications this change sends read it.
    pub fn keep_provider_object(&mut self, provider_object: PaymentProviderObjectRecord) {
        self.kept_provider_objects.push(provider_object);
    }

    pub async fn load(
        operation_context: &'context OperationContext,
        payment_id: &str,
    ) -> Result<Self, OperationError> {
        let payment = find_payment(operation_context, payment_id).await?;
        Ok(Self::start(operation_context, payment, Vec::new()).await)
    }

    /// The methods the payment's gateway offers, in its order.
    pub fn offered_method_keys(&self) -> Vec<String> {
        self.gateway_fields
            .as_ref()
            .map(|gateway_fields| gateway_fields.method_keys.clone())
            .unwrap_or_default()
    }

    pub(super) fn fire_event(&mut self, event_type: AppEventType) {
        self.fired_events.push(event_type);
    }

    pub fn add_timeline(&mut self, kind: &str, description: impl Into<String>) {
        add_timeline_event(self.operation_context, &mut self.payment, kind, description);
    }

    pub(super) fn format_money(&self, amount_minor: u64) -> String {
        let currency = &self.payment.summary.currency;
        format!("{} {currency}", format_major_amount(amount_minor, currency))
    }

    /// Paid in full, or only authorized when the payment is captured by hand; a checkout
    /// still open is completed and the customer sent to success.
    pub fn succeed(&mut self) {
        let had_checkout = self.payment.checkout_url.is_some();
        if self.payment.method.is_none() {
            self.use_default_test_method();
        }
        self.payment.summary.failure_code = None;
        let amount_text = self.format_money(self.payment.summary.amount_minor);
        let paid_event = if self.payment.capture_method == PaymentCaptureMethod::Manual {
            self.payment.summary.status = PaymentStatus::Authorized;
            self.add_timeline("authorized", format!("Authorized {amount_text}"));
            AppEventType::PaymentAuthorized
        } else {
            self.payment.summary.status = PaymentStatus::Succeeded;
            self.payment.captured_minor = self.payment.summary.amount_minor;
            self.add_timeline("succeeded", format!("Paid {amount_text}"));
            AppEventType::PaymentSucceeded
        };
        self.finish_checkout(RedirectOutcome::Success);
        if had_checkout {
            self.fired_events.push(AppEventType::CheckoutCompleted);
        }
        self.fired_events.push(paid_event);
    }

    /// The test method a payment settled without its checkout page is recorded with.
    fn use_default_test_method(&mut self) {
        let is_bkash = self.payment.summary.provider == "bkash";
        self.payment.method = Some(if is_bkash {
            PaymentInstrument::Wallet {
                wallet_name: "bKash".to_owned(),
                masked_number: "01770****21".to_owned(),
            }
        } else {
            PaymentInstrument::Card {
                brand: "visa".to_owned(),
                last4: "4242".to_owned(),
                exp_month: 12,
                exp_year: 2034,
            }
        });
        self.payment.method_key = Some(if is_bkash { "bkash" } else { "card" }.to_owned());
    }

    pub fn decline(&mut self, decline_reason: &str) {
        self.payment.summary.status = PaymentStatus::Failed;
        self.payment.summary.failure_code = Some(decline_reason.to_owned());
        self.add_timeline(
            "failed",
            format!("Declined: {}", decline_reason.replace('_', " ")),
        );
        self.finish_checkout(RedirectOutcome::Fail);
        self.fired_events.push(AppEventType::PaymentFailed);
    }

    pub fn cancel_checkout(&mut self) {
        self.payment.summary.status = PaymentStatus::Canceled;
        self.add_timeline("canceled", "Canceled by the customer");
        self.finish_checkout(RedirectOutcome::Cancel);
        self.fired_events.push(AppEventType::PaymentCanceled);
    }

    pub fn show_three_ds(&mut self) {
        self.payment.summary.status = PaymentStatus::RequiresAction;
        self.add_timeline("three_ds", "3-D Secure challenge shown");
    }

    pub fn open_dispute(&mut self) {
        self.payment.summary.status = PaymentStatus::Disputed;
        self.payment.dispute = Some(PaymentDispute {
            status: "needs_response".to_owned(),
            reason: "fraudulent".to_owned(),
            evidence: None,
        });
        self.add_timeline("dispute_opened", "Dispute opened: fraudulent");
        self.fired_events.push(AppEventType::PaymentDisputeOpened);
    }

    /// What the outcome profile does to a new checkout: wait for the page, or settle it at once.
    pub fn apply_outcome_profile(
        &mut self,
        outcome_profile: PaymentOutcomeProfile,
        random_success_rate_percent: u32,
    ) {
        let should_succeed = match outcome_profile {
            PaymentOutcomeProfile::Interactive => return,
            PaymentOutcomeProfile::AutoSuccess => true,
            PaymentOutcomeProfile::AutoDecline => false,
            PaymentOutcomeProfile::Random => {
                self.operation_context.random_source.next_u64() % 100
                    < u64::from(random_success_rate_percent)
            }
        };
        if should_succeed {
            self.succeed();
        } else {
            self.decline("generic_decline");
        }
    }

    /// The customer finished on the page but the payment settles later.
    pub fn delay(&mut self) {
        self.payment.checkout_url = None;
        self.add_timeline(
            "delayed",
            "The customer finished; the payment settles later",
        );
    }

    /// Closes the page and sends the customer back with the gateway's redirect fields.
    fn finish_checkout(&mut self, redirect_outcome: RedirectOutcome) {
        let payment_redirect = build_payment_redirect(
            self.operation_context,
            self.gateway_fields.as_ref(),
            &self.payment,
            redirect_outcome,
        );
        self.payment.checkout_url = None;
        if let Some(payment_redirect) = payment_redirect {
            self.payment.redirect = Some(payment_redirect);
            self.add_timeline(
                "redirected",
                format!("Redirected to the {} URL", redirect_outcome.as_str()),
            );
        }
    }

    /// Queues the gateway's notification for `event_type` again, under a new event id;
    /// false when the gateway is gone, has no notification endpoint or names no such event.
    pub async fn resend_notification(&mut self, event_type: &str) -> Result<bool, OperationError> {
        let Some(gateway_fields) = &self.gateway_fields else {
            return Ok(false);
        };
        let notification_count = self.payment.notifications.len();
        queue_payment_notification(
            self.operation_context,
            gateway_fields,
            &mut self.payment,
            event_type,
            &self.kept_provider_objects,
        )
        .await?;
        Ok(self.payment.notifications.len() > notification_count)
    }

    /// Queues the gateway's notification for each event, stores the payment, then publishes
    /// its events in order, each carrying the payment.
    pub async fn save(mut self) -> Result<PaymentDetail, OperationError> {
        let operation_context = self.operation_context;
        if let Some(gateway_fields) = &self.gateway_fields {
            for event_type in &self.fired_events {
                queue_payment_notification(
                    operation_context,
                    gateway_fields,
                    &mut self.payment,
                    event_type.as_str(),
                    &self.kept_provider_objects,
                )
                .await?;
            }
        }
        save_payment(
            operation_context,
            &self.payment,
            operation_context.clock.now_unix_ms(),
        )
        .await?;
        for provider_object in self.kept_provider_objects {
            operation_context
                .payment_stores
                .provider_objects
                .save_object(provider_object)
                .await?;
        }
        let event_data = build_payment_event_data(&self.payment);
        for event_type in self.fired_events {
            publish_event(operation_context, event_type, event_data.clone());
        }
        Ok(self.payment)
    }
}
