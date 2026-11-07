use sendmock_store::PaymentProviderObjectRecord;
use serde::{Deserialize, Serialize};

use super::paypal_call::{PAYPAL_PROVIDER_KEY, PayPalCall};
use super::paypal_error::{PayPalApi, PayPalError};
use crate::payments::{
    PaymentDetail, ProviderObjectKey, find_provider_object, list_kept_or_stored_objects,
    read_kept_or_stored_object, read_payment_document,
};
use crate::{OperationContext, OperationError};

pub const ORDER_OBJECT_KIND: &str = "order";
pub const CAPTURE_OBJECT_KIND: &str = "capture";
pub const REFUND_OBJECT_KIND: &str = "refund";

/// What a PayPal order keeps that a payment does not: its purchase unit's own fields and
/// whether the app sent a `payment_source`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PayPalOrderState {
    #[serde(default)]
    pub reference_id: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub custom_id: Option<String>,
    #[serde(default)]
    pub invoice_id: Option<String>,
    #[serde(default)]
    pub has_payment_source: bool,
}

/// The capture made when an approved order was captured.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PayPalCaptureState {
    pub order_id: String,
    pub amount_minor: u64,
    pub currency: String,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PayPalRefundState {
    pub capture_id: String,
    pub amount_minor: u64,
    pub currency: String,
    pub note_to_payer: Option<String>,
    pub invoice_id: Option<String>,
    pub created_at: String,
}

pub fn paypal_object_key<'key>(
    object_kind: &'key str,
    object_id: &'key str,
) -> ProviderObjectKey<'key> {
    ProviderObjectKey {
        provider: PAYPAL_PROVIDER_KEY,
        object_kind,
        object_id,
    }
}

pub fn read_order_id(payment: &PaymentDetail) -> String {
    payment
        .provider_ids
        .get("order")
        .cloned()
        .unwrap_or_default()
}

/// The payment behind an order id, or PayPal's `404`.
pub async fn find_order_payment(
    paypal_call: &PayPalCall<'_>,
    order_id: &str,
) -> Result<PaymentDetail, PayPalError> {
    let stored_payment = paypal_call
        .operation_context
        .payment_repository
        .find_payment_by_provider_id(PAYPAL_PROVIDER_KEY, order_id)
        .await
        .map_err(OperationError::from)?;
    let payment = stored_payment
        .map(|stored_payment| read_payment_document(&stored_payment))
        .transpose()?
        .filter(|payment| read_order_id(payment) == order_id);
    payment.ok_or_else(|| PayPalError::resource_missing(PayPalApi::Orders, "order_id", order_id))
}

/// A capture or refund with the payment it belongs to, or PayPal's `404`.
pub async fn find_payment_object<T: serde::de::DeserializeOwned>(
    paypal_call: &PayPalCall<'_>,
    object_kind: &str,
    object_id: &str,
) -> Result<(PaymentDetail, T), PayPalError> {
    let operation_context = paypal_call.operation_context;
    let missing_field = format!("{object_kind}_id");
    let (payment_id, document) =
        find_provider_object(operation_context, paypal_object_key(object_kind, object_id))
            .await?
            .ok_or_else(|| {
                PayPalError::resource_missing(PayPalApi::Payments, &missing_field, object_id)
            })?;
    let payment = crate::payments::find_payment(operation_context, &payment_id).await?;
    Ok((payment, document))
}

/// What a PayPal payment keeps beside it: the order, its captures and its refunds.
pub struct PayPalPaymentObjects {
    pub order_state: PayPalOrderState,
    pub captures: Vec<(String, PayPalCaptureState)>,
    pub refunds: Vec<(String, PayPalRefundState)>,
}

pub async fn load_paypal_objects(
    paypal_call: &PayPalCall<'_>,
    payment: &PaymentDetail,
) -> Result<PayPalPaymentObjects, PayPalError> {
    Ok(load_kept_paypal_objects(paypal_call.operation_context, payment, &[]).await?)
}

/// The payment's PayPal objects, those kept with a change it is making included.
pub async fn load_kept_paypal_objects(
    operation_context: &OperationContext,
    payment: &PaymentDetail,
    kept_objects: &[PaymentProviderObjectRecord],
) -> Result<PayPalPaymentObjects, OperationError> {
    let order_state = read_kept_or_stored_object(
        operation_context,
        kept_objects,
        paypal_object_key(ORDER_OBJECT_KIND, &read_order_id(payment)),
    )
    .await?;
    let payment_id = &payment.summary.id;
    Ok(PayPalPaymentObjects {
        order_state,
        captures: list_kept_or_stored_objects(
            operation_context,
            kept_objects,
            payment_id,
            CAPTURE_OBJECT_KIND,
        )
        .await?,
        refunds: list_kept_or_stored_objects(
            operation_context,
            kept_objects,
            payment_id,
            REFUND_OBJECT_KIND,
        )
        .await?,
    })
}
