use std::collections::BTreeMap;

use sendmock_core::format_rfc3339;

use super::subscription_store::StoredSubscription;
use super::subscription_views::{SubscriptionStatus, SubscriptionTimelineEvent};
use crate::payments::{
    PaymentCaptureMethod, PaymentLineItem, PaymentStatus, ProviderPaymentRequest,
    find_payment_method, pay_with_test_card, start_provider_payment,
};
use crate::{AppEventType, OperationContext, OperationError};

/// Whether the card method's table lists the number, so it can pay renewals.
pub async fn is_test_card(
    operation_context: &OperationContext,
    card_number: &str,
) -> Result<bool, OperationError> {
    let card_method = find_payment_method(operation_context, "card").await?;
    Ok(card_method
        .fields
        .test_cards
        .iter()
        .any(|test_card| test_card.number == card_number))
}

pub fn add_timeline(
    stored_subscription: &mut StoredSubscription,
    kind: &str,
    description: String,
    created_at: String,
) {
    stored_subscription
        .subscription
        .timeline
        .push(SubscriptionTimelineEvent {
            kind: kind.to_owned(),
            description,
            created_at,
        });
}

fn build_renewal_request(stored_subscription: &StoredSubscription) -> ProviderPaymentRequest {
    let subscription = &stored_subscription.subscription;
    ProviderPaymentRequest {
        provider: subscription.provider.clone(),
        amount_minor: subscription.amount_minor,
        currency: subscription.currency.clone(),
        customer_email: Some(subscription.customer_email.clone()),
        line_items: vec![PaymentLineItem {
            name: subscription.plan_name.clone(),
            quantity: 1,
            unit_amount_minor: subscription.amount_minor,
        }],
        metadata: BTreeMap::from([("subscription_id".to_owned(), subscription.id.clone())]),
        capture_method: PaymentCaptureMethod::Automatic,
        checkout: None,
    }
}

/// Charges the period that starts now as a payment through the gateway with the subscription's
/// test card; a card that declines, or asks for 3-D Secure off session, leaves it past due.
pub async fn charge_period(
    operation_context: &OperationContext,
    stored_subscription: &mut StoredSubscription,
) -> Result<AppEventType, OperationError> {
    let mut payment_change = start_provider_payment(
        operation_context,
        build_renewal_request(stored_subscription),
    )
    .await?;
    pay_with_test_card(
        &mut payment_change,
        operation_context,
        &stored_subscription.card_number,
    )
    .await?;
    if payment_change.payment.summary.status == PaymentStatus::RequiresAction {
        payment_change.decline("authentication_failed");
    }
    let renewal_payment = payment_change.save().await?;
    let charged_at = format_rfc3339(operation_context.clock.now_unix_ms());
    stored_subscription
        .subscription
        .payment_ids
        .push(renewal_payment.summary.id.clone());
    if renewal_payment.summary.status == PaymentStatus::Failed {
        stored_subscription.subscription.status = SubscriptionStatus::PastDue;
        let failure_code = renewal_payment
            .summary
            .failure_code
            .unwrap_or_else(|| "declined".to_owned());
        add_timeline(
            stored_subscription,
            "payment_failed",
            format!("Payment failed: {}", failure_code.replace('_', " ")),
            charged_at,
        );
        return Ok(AppEventType::SubscriptionPaymentFailed);
    }
    stored_subscription.subscription.status = SubscriptionStatus::Active;
    stored_subscription.subscription.renewal_count += 1;
    add_timeline(
        stored_subscription,
        "renewed",
        "Paid for the period".to_owned(),
        charged_at,
    );
    Ok(AppEventType::SubscriptionRenewed)
}
