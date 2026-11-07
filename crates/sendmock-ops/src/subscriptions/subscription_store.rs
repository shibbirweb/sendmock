use sendmock_store::PaymentSubscriptionRecord;
use serde::{Deserialize, Serialize};

use super::subscription_views::PaymentSubscription;
use crate::{OperationContext, OperationError};

/// What SendMock keeps: the subscription and the test card its renewals are charged to.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredSubscription {
    pub subscription: PaymentSubscription,
    pub card_number: String,
}

fn to_internal_error(json_error: serde_json::Error) -> OperationError {
    OperationError::Internal(json_error.to_string())
}

fn read_stored_subscription(
    subscription_record: &PaymentSubscriptionRecord,
) -> Result<StoredSubscription, OperationError> {
    serde_json::from_str(&subscription_record.document_json).map_err(to_internal_error)
}

pub async fn list_stored_subscriptions(
    operation_context: &OperationContext,
) -> Result<Vec<StoredSubscription>, OperationError> {
    operation_context
        .payment_stores
        .subscriptions
        .list_subscriptions()
        .await?
        .iter()
        .map(read_stored_subscription)
        .collect()
}

pub async fn find_stored_subscription(
    operation_context: &OperationContext,
    subscription_id: &str,
) -> Result<StoredSubscription, OperationError> {
    let subscription_record = operation_context
        .payment_stores
        .subscriptions
        .find_subscription(subscription_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No subscription with the ID {subscription_id}"),
        })?;
    read_stored_subscription(&subscription_record)
}

pub async fn save_stored_subscription(
    operation_context: &OperationContext,
    stored_subscription: &StoredSubscription,
) -> Result<(), OperationError> {
    let subscription_record = PaymentSubscriptionRecord {
        subscription_id: stored_subscription.subscription.id.clone(),
        document_json: serde_json::to_string(stored_subscription).map_err(to_internal_error)?,
        created_at_unix_ms: sendmock_core::parse_rfc3339(
            &stored_subscription.subscription.created_at,
        )
        .unwrap_or_default(),
    };
    operation_context
        .payment_stores
        .subscriptions
        .save_subscription(subscription_record)
        .await?;
    Ok(())
}
