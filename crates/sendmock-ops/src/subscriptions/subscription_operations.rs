use serde_json::Value;

use super::subscription_lifecycle::{
    advance_subscription, cancel_subscription, create_subscription,
};
use super::subscription_store::{
    StoredSubscription, find_stored_subscription, list_stored_subscriptions,
    save_stored_subscription,
};
use super::subscription_views::{
    PaymentSubscription, PaymentSubscriptionCancelRequest, PaymentSubscriptionCreateRequest,
    SubscriptionPathInput,
};
use crate::events::publish_event;
use crate::{
    AppEventType, HttpMethod, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, SuccessStatus,
};

fn subscription_definition(
    operation_id: &'static str,
    method: HttpMethod,
    path: &'static str,
    summary: &'static str,
    cli_usage: &'static str,
    mcp_tool: &'static str,
) -> OperationDefinition {
    OperationDefinition {
        operation_id,
        method,
        path,
        summary,
        is_read_only: method == HttpMethod::Get,
        cli_usage,
        mcp_tool,
        ..OperationDefinition::DEFAULTS
    }
}

/// Stores the change, then publishes its events, each carrying the subscription.
async fn save_and_publish(
    operation_context: &OperationContext,
    stored_subscription: &StoredSubscription,
    fired_events: &[AppEventType],
) -> Result<PaymentSubscription, OperationError> {
    save_stored_subscription(operation_context, stored_subscription).await?;
    let event_data = serde_json::to_value(&stored_subscription.subscription).unwrap_or(Value::Null);
    for event_type in fired_events {
        publish_event(operation_context, *event_type, event_data.clone());
    }
    Ok(stored_subscription.subscription.clone())
}

pub struct ListSubscriptionsOperation;

impl Operation for ListSubscriptionsOperation {
    type Input = NoInput;
    type Output = Vec<PaymentSubscription>;

    fn definition(&self) -> OperationDefinition {
        subscription_definition(
            "getPaymentsSubscriptions",
            HttpMethod::Get,
            "/api/v1/payments/subscriptions",
            "Subscriptions, newest first.",
            "sendmock payments subscriptions list",
            "sendmock_subscription_list",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<PaymentSubscription>, OperationError> {
        let stored_subscriptions = list_stored_subscriptions(operation_context).await?;
        Ok(stored_subscriptions
            .into_iter()
            .map(|stored_subscription| stored_subscription.subscription)
            .collect())
    }
}

pub struct CreateSubscriptionOperation;

impl Operation for CreateSubscriptionOperation {
    type Input = PaymentSubscriptionCreateRequest;
    type Output = PaymentSubscription;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            success_status: SuccessStatus::Created,
            ..subscription_definition(
                "postPaymentsSubscriptions",
                HttpMethod::Post,
                "/api/v1/payments/subscriptions",
                "Start a subscription on a gateway, with an optional trial.",
                "sendmock payments subscriptions create",
                "sendmock_subscription_create",
            )
        }
    }

    /// A trial waits; otherwise the first period is charged at once (PY-07.4).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentSubscriptionCreateRequest,
    ) -> Result<PaymentSubscription, OperationError> {
        let (stored_subscription, fired_events) =
            create_subscription(operation_context, input).await?;
        save_and_publish(operation_context, &stored_subscription, &fired_events).await
    }
}

pub struct GetSubscriptionOperation;

impl Operation for GetSubscriptionOperation {
    type Input = SubscriptionPathInput;
    type Output = PaymentSubscription;

    fn definition(&self) -> OperationDefinition {
        subscription_definition(
            "getPaymentsSubscriptionsBySubscriptionId",
            HttpMethod::Get,
            "/api/v1/payments/subscriptions/{subscriptionId}",
            "One subscription with its timeline and renewal payments.",
            "sendmock payments subscriptions show <subscriptionId>",
            "sendmock_subscription_get",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SubscriptionPathInput,
    ) -> Result<PaymentSubscription, OperationError> {
        Ok(
            find_stored_subscription(operation_context, &input.subscription_id)
                .await?
                .subscription,
        )
    }
}

pub struct AdvanceSubscriptionOperation;

impl Operation for AdvanceSubscriptionOperation {
    type Input = SubscriptionPathInput;
    type Output = PaymentSubscription;

    fn definition(&self) -> OperationDefinition {
        subscription_definition(
            "postPaymentsSubscriptionsBySubscriptionIdAdvance",
            HttpMethod::Post,
            "/api/v1/payments/subscriptions/{subscriptionId}/advance",
            "Move the subscription's clock to its next renewal and charge it.",
            "sendmock payments subscriptions advance <subscriptionId>",
            "sendmock_subscription_advance",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SubscriptionPathInput,
    ) -> Result<PaymentSubscription, OperationError> {
        let mut stored_subscription =
            find_stored_subscription(operation_context, &input.subscription_id).await?;
        let fired_event = advance_subscription(operation_context, &mut stored_subscription).await?;
        save_and_publish(operation_context, &stored_subscription, &[fired_event]).await
    }
}

pub struct CancelSubscriptionOperation;

impl Operation for CancelSubscriptionOperation {
    type Input = PaymentSubscriptionCancelRequest;
    type Output = PaymentSubscription;

    fn definition(&self) -> OperationDefinition {
        subscription_definition(
            "postPaymentsSubscriptionsBySubscriptionIdCancel",
            HttpMethod::Post,
            "/api/v1/payments/subscriptions/{subscriptionId}/cancel",
            "Cancel the subscription now or at the end of its period.",
            "sendmock payments subscriptions cancel <subscriptionId>",
            "sendmock_subscription_cancel",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PaymentSubscriptionCancelRequest,
    ) -> Result<PaymentSubscription, OperationError> {
        let mut stored_subscription =
            find_stored_subscription(operation_context, &input.subscription_id).await?;
        let fired_event = cancel_subscription(
            operation_context,
            &mut stored_subscription,
            input.at_period_end.unwrap_or(false),
        )?;
        save_and_publish(
            operation_context,
            &stored_subscription,
            fired_event.as_slice(),
        )
        .await
    }
}
