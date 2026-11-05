use sendmock_store::PaymentProviderObjectRecord;
use serde::Serialize;
use serde::de::DeserializeOwned;

use super::stripe_error::StripeError;
use crate::{OperationContext, OperationError};

pub const STRIPE_PROVIDER_KEY: &str = "stripe";

/// What Stripe keeps beside a payment: a PaymentIntent's attached PaymentMethod, a Checkout
/// Session's mode, a refund.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StripeObjectKind {
    PaymentIntent,
    CheckoutSession,
    Refund,
}

impl StripeObjectKind {
    fn as_str(self) -> &'static str {
        match self {
            Self::PaymentIntent => "payment_intent",
            Self::CheckoutSession => "checkout_session",
            Self::Refund => "refund",
        }
    }
}

fn read_document<T: DeserializeOwned>(
    stored_object: &PaymentProviderObjectRecord,
) -> Result<T, StripeError> {
    serde_json::from_str(&stored_object.document_json)
        .map_err(|read_error| OperationError::Internal(read_error.to_string()).into())
}

/// The stored object, or `None` when Stripe has none with this id.
pub async fn find_stripe_object<T: DeserializeOwned>(
    operation_context: &OperationContext,
    object_kind: StripeObjectKind,
    object_id: &str,
) -> Result<Option<(String, T)>, StripeError> {
    let stored_object = operation_context
        .payment_provider_object_repository
        .find_object(STRIPE_PROVIDER_KEY, object_kind.as_str(), object_id)
        .await
        .map_err(OperationError::from)?;
    stored_object
        .map(|stored_object| {
            read_document(&stored_object).map(|document| (stored_object.payment_id, document))
        })
        .transpose()
}

/// The object's document, or its default when nothing was kept for it yet.
pub async fn load_stripe_object<T: DeserializeOwned + Default>(
    operation_context: &OperationContext,
    object_kind: StripeObjectKind,
    object_id: &str,
) -> Result<T, StripeError> {
    Ok(
        find_stripe_object(operation_context, object_kind, object_id)
            .await?
            .map(|(_, document)| document)
            .unwrap_or_default(),
    )
}

pub async fn save_stripe_object<T: Serialize>(
    operation_context: &OperationContext,
    object_kind: StripeObjectKind,
    object_id: &str,
    payment_id: &str,
    document: &T,
) -> Result<(), StripeError> {
    let document_json = serde_json::to_string(document)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
    let now_unix_ms = operation_context.clock.now_unix_ms();
    operation_context
        .payment_provider_object_repository
        .save_object(PaymentProviderObjectRecord {
            object_id: object_id.to_owned(),
            provider: STRIPE_PROVIDER_KEY.to_owned(),
            object_kind: object_kind.as_str().to_owned(),
            payment_id: payment_id.to_owned(),
            document_json,
            created_at_unix_ms: now_unix_ms,
            updated_at_unix_ms: now_unix_ms,
        })
        .await
        .map_err(OperationError::from)?;
    Ok(())
}
