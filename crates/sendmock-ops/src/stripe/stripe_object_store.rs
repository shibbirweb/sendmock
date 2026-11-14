use sendmock_store::PaymentProviderObjectRecord;
use serde::Serialize;
use serde::de::DeserializeOwned;

use super::stripe_error::StripeError;
use crate::payments::{
    PaymentChange, ProviderObjectKey, find_provider_object, keep_provider_object,
    read_kept_or_stored_object as read_kept_or_stored_provider_object, save_provider_object,
};
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

fn stripe_object_key(object_kind: StripeObjectKind, object_id: &str) -> ProviderObjectKey<'_> {
    ProviderObjectKey {
        provider: STRIPE_PROVIDER_KEY,
        object_kind: object_kind.as_str(),
        object_id,
    }
}

/// The stored object, or `None` when Stripe has none with this id.
pub async fn find_stripe_object<T: DeserializeOwned>(
    operation_context: &OperationContext,
    object_kind: StripeObjectKind,
    object_id: &str,
) -> Result<Option<(String, T)>, StripeError> {
    Ok(find_provider_object(operation_context, stripe_object_key(object_kind, object_id)).await?)
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
    Ok(save_provider_object(
        operation_context,
        stripe_object_key(object_kind, object_id),
        payment_id,
        document,
    )
    .await?)
}

/// Keeps the object with the payment change, so it is stored with the payment and the
/// notifications the change sends already read it.
pub fn keep_stripe_object<T: Serialize>(
    payment_change: &mut PaymentChange<'_>,
    object_kind: StripeObjectKind,
    object_id: &str,
    document: &T,
) -> Result<(), StripeError> {
    Ok(keep_provider_object(
        payment_change,
        stripe_object_key(object_kind, object_id),
        document,
    )?)
}

/// The object's document: the one kept with a change, else the stored one, else its default.
pub async fn read_kept_or_stored_object<T: DeserializeOwned + Default>(
    operation_context: &OperationContext,
    kept_objects: &[PaymentProviderObjectRecord],
    object_kind: StripeObjectKind,
    object_id: &str,
) -> Result<T, OperationError> {
    read_kept_or_stored_provider_object(
        operation_context,
        kept_objects,
        stripe_object_key(object_kind, object_id),
    )
    .await
}
