use sendmock_store::PaymentProviderObjectRecord;
use serde::Serialize;
use serde::de::DeserializeOwned;

use super::payment_change::PaymentChange;
use crate::{OperationContext, OperationError};

/// Which provider object: the gateway's key, the kind in the provider's words and its id.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProviderObjectKey<'key> {
    pub provider: &'key str,
    pub object_kind: &'key str,
    pub object_id: &'key str,
}

impl ProviderObjectKey<'_> {
    fn matches(&self, provider_object: &PaymentProviderObjectRecord) -> bool {
        provider_object.provider == self.provider
            && provider_object.object_kind == self.object_kind
            && provider_object.object_id == self.object_id
    }
}

fn read_document<T: DeserializeOwned>(
    provider_object: &PaymentProviderObjectRecord,
) -> Result<T, OperationError> {
    serde_json::from_str(&provider_object.document_json)
        .map_err(|read_error| OperationError::Internal(read_error.to_string()))
}

/// The object as the row it is stored in.
pub fn build_provider_object_record<T: Serialize>(
    operation_context: &OperationContext,
    object_key: ProviderObjectKey<'_>,
    payment_id: &str,
    document: &T,
) -> Result<PaymentProviderObjectRecord, OperationError> {
    let document_json = serde_json::to_string(document)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
    let now_unix_ms = operation_context.clock.now_unix_ms();
    Ok(PaymentProviderObjectRecord {
        object_id: object_key.object_id.to_owned(),
        provider: object_key.provider.to_owned(),
        object_kind: object_key.object_kind.to_owned(),
        payment_id: payment_id.to_owned(),
        document_json,
        created_at_unix_ms: now_unix_ms,
        updated_at_unix_ms: now_unix_ms,
    })
}

/// The stored object with the payment it belongs to, or `None` when there is none.
pub async fn find_provider_object<T: DeserializeOwned>(
    operation_context: &OperationContext,
    object_key: ProviderObjectKey<'_>,
) -> Result<Option<(String, T)>, OperationError> {
    let stored_object = operation_context
        .payment_provider_object_repository
        .find_object(
            object_key.provider,
            object_key.object_kind,
            object_key.object_id,
        )
        .await?;
    stored_object
        .map(|stored_object| {
            read_document(&stored_object).map(|document| (stored_object.payment_id, document))
        })
        .transpose()
}

pub async fn save_provider_object<T: Serialize>(
    operation_context: &OperationContext,
    object_key: ProviderObjectKey<'_>,
    payment_id: &str,
    document: &T,
) -> Result<(), OperationError> {
    let stored_object =
        build_provider_object_record(operation_context, object_key, payment_id, document)?;
    operation_context
        .payment_provider_object_repository
        .save_object(stored_object)
        .await?;
    Ok(())
}

/// Keeps the object with the payment change, so it is stored with the payment and the
/// notifications the change sends already read it.
pub fn keep_provider_object<T: Serialize>(
    payment_change: &mut PaymentChange<'_>,
    object_key: ProviderObjectKey<'_>,
    document: &T,
) -> Result<(), OperationError> {
    let payment_id = payment_change.payment.summary.id.clone();
    let kept_object = build_provider_object_record(
        payment_change.operation_context(),
        object_key,
        &payment_id,
        document,
    )?;
    payment_change.keep_provider_object(kept_object);
    Ok(())
}

/// The object's document: the one kept with a change, else the stored one, else its default.
pub async fn read_kept_or_stored_object<T: DeserializeOwned + Default>(
    operation_context: &OperationContext,
    kept_objects: &[PaymentProviderObjectRecord],
    object_key: ProviderObjectKey<'_>,
) -> Result<T, OperationError> {
    if let Some(kept_object) = kept_objects
        .iter()
        .rev()
        .find(|kept_object| object_key.matches(kept_object))
    {
        return read_document(kept_object);
    }
    Ok(find_provider_object(operation_context, object_key)
        .await?
        .map(|(_, document)| document)
        .unwrap_or_default())
}

/// A payment's objects of one kind with their ids, oldest first.
pub async fn list_payment_provider_objects<T: DeserializeOwned>(
    operation_context: &OperationContext,
    payment_id: &str,
    object_kind: &str,
) -> Result<Vec<(String, T)>, OperationError> {
    operation_context
        .payment_provider_object_repository
        .list_payment_objects(payment_id, object_kind)
        .await?
        .iter()
        .map(|stored_object| {
            read_document(stored_object).map(|document| (stored_object.object_id.clone(), document))
        })
        .collect()
}

/// A payment's objects of one kind, oldest first, with those kept with a change: a kept
/// object replaces the stored one with its id, so a notification reads what is being saved.
pub async fn list_kept_or_stored_objects<T: DeserializeOwned>(
    operation_context: &OperationContext,
    kept_objects: &[PaymentProviderObjectRecord],
    payment_id: &str,
    object_kind: &str,
) -> Result<Vec<(String, T)>, OperationError> {
    let mut payment_objects =
        list_payment_provider_objects(operation_context, payment_id, object_kind).await?;
    let matching_kept_objects = kept_objects.iter().filter(|kept_object| {
        kept_object.payment_id == payment_id && kept_object.object_kind == object_kind
    });
    for kept_object in matching_kept_objects {
        let kept_document = read_document(kept_object)?;
        let stored_entry = payment_objects
            .iter_mut()
            .find(|(object_id, _)| *object_id == kept_object.object_id);
        match stored_entry {
            Some(stored_entry) => stored_entry.1 = kept_document,
            None => payment_objects.push((kept_object.object_id.clone(), kept_document)),
        }
    }
    Ok(payment_objects)
}
