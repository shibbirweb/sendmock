use sendmock_core::{add_calendar_months, format_rfc3339, parse_rfc3339};

use super::subscription_charge::{add_timeline, charge_period, is_test_card};
use super::subscription_store::StoredSubscription;
use super::subscription_views::{
    PaymentSubscription, PaymentSubscriptionCreateRequest, SubscriptionInterval, SubscriptionStatus,
};
use crate::payments::find_payment_gateway;
use crate::{AppEventType, OperationContext, OperationError};

const DEFAULT_CARD_NUMBER: &str = "4242424242424242";
const DAY_MS: i64 = 86_400_000;

/// The timestamp one interval later; months and years end on a shorter month's last day.
pub fn add_interval(timestamp_text: &str, interval: SubscriptionInterval) -> String {
    let start_unix_ms = parse_rfc3339(timestamp_text).unwrap_or_default();
    let next_unix_ms = match interval {
        SubscriptionInterval::Day => start_unix_ms + DAY_MS,
        SubscriptionInterval::Week => start_unix_ms + 7 * DAY_MS,
        SubscriptionInterval::Month => add_calendar_months(start_unix_ms, 1),
        SubscriptionInterval::Year => add_calendar_months(start_unix_ms, 12),
    };
    format_rfc3339(next_unix_ms)
}

fn check_create_request(
    create_request: &PaymentSubscriptionCreateRequest,
) -> Result<(), OperationError> {
    if create_request.plan_name.trim().is_empty() || create_request.amount_minor == 0 {
        return Err(OperationError::InvalidInput {
            message: "A plan name and an amount above 0 are required".to_owned(),
            field: Some(
                if create_request.amount_minor == 0 {
                    "amount_minor"
                } else {
                    "plan_name"
                }
                .to_owned(),
            ),
        });
    }
    if !create_request.customer_email.contains('@') {
        return Err(OperationError::InvalidInput {
            message: "customer_email is not an email address".to_owned(),
            field: Some("customer_email".to_owned()),
        });
    }
    Ok(())
}

fn read_trial_end(now_unix_ms: i64, trial_days: u32) -> Option<String> {
    (trial_days > 0).then(|| format_rfc3339(now_unix_ms + i64::from(trial_days) * DAY_MS))
}

fn read_card_last4(card_number: &str) -> String {
    card_number
        .chars()
        .skip(card_number.len().saturating_sub(4))
        .collect()
}

async fn build_subscription(
    operation_context: &OperationContext,
    create_request: PaymentSubscriptionCreateRequest,
    card_number: String,
) -> Result<StoredSubscription, OperationError> {
    let payment_gateway = find_payment_gateway(operation_context, &create_request.provider).await?;
    let default_currency = operation_context
        .settings_store
        .current()
        .await?
        .payment_default_currency;
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let created_at = format_rfc3339(now_unix_ms);
    let trial_end = read_trial_end(now_unix_ms, create_request.trial_days.unwrap_or_default());
    let subscription = PaymentSubscription {
        id: operation_context.id_generator.generate_id().to_string(),
        provider: create_request.provider,
        provider_name: payment_gateway.fields.name,
        customer_email: create_request.customer_email.trim().to_owned(),
        plan_name: create_request.plan_name.trim().to_owned(),
        amount_minor: create_request.amount_minor,
        currency: create_request
            .currency
            .unwrap_or(default_currency)
            .to_ascii_uppercase(),
        interval: create_request.interval,
        status: if trial_end.is_some() {
            SubscriptionStatus::Trialing
        } else {
            SubscriptionStatus::Active
        },
        card_last4: read_card_last4(&card_number),
        current_period_end: trial_end
            .clone()
            .unwrap_or_else(|| add_interval(&created_at, create_request.interval)),
        trial_end,
        current_period_start: created_at.clone(),
        cancel_at_period_end: false,
        canceled_at: None,
        renewal_count: 0,
        payment_ids: Vec::new(),
        created_at,
        timeline: Vec::new(),
    };
    Ok(StoredSubscription {
        subscription,
        card_number,
    })
}

/// Starts a subscription: a trial waits, otherwise the first period is charged at once.
pub async fn create_subscription(
    operation_context: &OperationContext,
    create_request: PaymentSubscriptionCreateRequest,
) -> Result<(StoredSubscription, Vec<AppEventType>), OperationError> {
    check_create_request(&create_request)?;
    let card_number = create_request
        .card_number
        .clone()
        .unwrap_or_else(|| DEFAULT_CARD_NUMBER.to_owned())
        .replace(' ', "");
    if !is_test_card(operation_context, &card_number).await? {
        return Err(OperationError::Unprocessable {
            code: "not_a_test_card",
            message: "Use a test card".to_owned(),
        });
    }
    let trial_days = create_request.trial_days.unwrap_or_default();
    let mut stored_subscription =
        build_subscription(operation_context, create_request, card_number).await?;
    let created_at = stored_subscription.subscription.created_at.clone();
    let description = if trial_days > 0 {
        format!("Trial of {trial_days} days")
    } else {
        "Subscription started".to_owned()
    };
    add_timeline(&mut stored_subscription, "created", description, created_at);
    let mut fired_events = vec![AppEventType::SubscriptionCreated];
    if trial_days == 0 {
        fired_events.push(charge_period(operation_context, &mut stored_subscription).await?);
    }
    Ok((stored_subscription, fired_events))
}

fn refuse_canceled() -> OperationError {
    OperationError::Conflict {
        code: "subscription_canceled",
        message: "The subscription is canceled".to_owned(),
    }
}

/// The subscription's clock moves to its next renewal (PY-07.4).
pub async fn advance_subscription(
    operation_context: &OperationContext,
    stored_subscription: &mut StoredSubscription,
) -> Result<AppEventType, OperationError> {
    let subscription = &mut stored_subscription.subscription;
    if subscription.status == SubscriptionStatus::Canceled {
        return Err(refuse_canceled());
    }
    let period_start = subscription.current_period_end.clone();
    if subscription.cancel_at_period_end {
        subscription.status = SubscriptionStatus::Canceled;
        subscription.canceled_at = Some(period_start.clone());
        add_timeline(
            stored_subscription,
            "canceled",
            "Ended at the period end".to_owned(),
            period_start,
        );
        return Ok(AppEventType::SubscriptionCanceled);
    }
    subscription.current_period_end = add_interval(&period_start, subscription.interval);
    subscription.current_period_start = period_start;
    subscription.trial_end = None;
    charge_period(operation_context, stored_subscription).await
}

/// Cancels now, or marks it to end at the next advance; `None` when no event fires.
pub fn cancel_subscription(
    operation_context: &OperationContext,
    stored_subscription: &mut StoredSubscription,
    is_at_period_end: bool,
) -> Result<Option<AppEventType>, OperationError> {
    if stored_subscription.subscription.status == SubscriptionStatus::Canceled {
        return Err(refuse_canceled());
    }
    let canceled_at = format_rfc3339(operation_context.clock.now_unix_ms());
    if is_at_period_end {
        stored_subscription.subscription.cancel_at_period_end = true;
        add_timeline(
            stored_subscription,
            "cancel_scheduled",
            "Ends at the period end".to_owned(),
            canceled_at,
        );
        return Ok(None);
    }
    stored_subscription.subscription.status = SubscriptionStatus::Canceled;
    stored_subscription.subscription.canceled_at = Some(canceled_at.clone());
    add_timeline(
        stored_subscription,
        "canceled",
        "Canceled".to_owned(),
        canceled_at,
    );
    Ok(Some(AppEventType::SubscriptionCanceled))
}
