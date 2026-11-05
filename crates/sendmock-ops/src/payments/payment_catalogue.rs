use std::collections::BTreeMap;

use sendmock_store::{PaymentCountColumn, PaymentRecord};

use super::payment_views::{PaymentDetail, PaymentTimelineEvent};
use crate::{OperationContext, OperationError};

/// The ids a gateway gives a new checkout, as its real API names them; `suffix` makes them
/// unique. A custom gateway gets one `reference`.
pub fn build_provider_ids(provider: &str, suffix: &str) -> BTreeMap<String, String> {
    let provider_ids: Vec<(&str, String)> = match provider {
        "stripe" => vec![
            ("checkout_session", format!("cs_test_{suffix}")),
            ("payment_intent", format!("pi_{suffix}")),
        ],
        "paypal" => vec![(
            "order",
            suffix
                .chars()
                .take(10)
                .collect::<String>()
                .to_ascii_uppercase(),
        )],
        "sslcommerz" => vec![
            ("tran_id", format!("TXN{suffix}")),
            ("val_id", format!("VAL{suffix}")),
        ],
        "bkash" => vec![
            ("payment_id", format!("TR00{suffix}")),
            (
                "trx_id",
                format!("TRX{}", suffix.chars().take(8).collect::<String>()),
            ),
        ],
        "native" => vec![("payment", format!("pay_{suffix}"))],
        custom_provider => vec![(
            "reference",
            format!("{}-{suffix}", custom_provider.to_ascii_uppercase()),
        )],
    };
    provider_ids
        .into_iter()
        .map(|(id_name, id_value)| (id_name.to_owned(), id_value))
        .collect()
}

/// The id the gateway's own API answers with first, which the list shows.
pub fn read_provider_reference(
    provider: &str,
    provider_ids: &BTreeMap<String, String>,
) -> Option<String> {
    if provider == "stripe" {
        return provider_ids
            .get("checkout_session")
            .or_else(|| provider_ids.get("payment_intent"))
            .cloned();
    }
    let first_id_name = match provider {
        "paypal" => "order",
        "sslcommerz" => "tran_id",
        "bkash" => "payment_id",
        "native" => "payment",
        _ => "reference",
    };
    provider_ids.get(first_id_name).cloned()
}

/// Payments stored before manual capture existed read as captured automatically.
pub fn read_payment_document(
    stored_payment: &PaymentRecord,
) -> Result<PaymentDetail, OperationError> {
    let to_internal_error =
        |read_error: serde_json::Error| OperationError::Internal(read_error.to_string());
    let mut payment_document: serde_json::Value =
        serde_json::from_str(&stored_payment.document_json).map_err(to_internal_error)?;
    if let Some(payment_fields) = payment_document.as_object_mut() {
        payment_fields
            .entry("capture_method")
            .or_insert_with(|| serde_json::json!("automatic"));
    }
    serde_json::from_value(payment_document).map_err(to_internal_error)
}

pub async fn find_payment(
    operation_context: &OperationContext,
    payment_id: &str,
) -> Result<PaymentDetail, OperationError> {
    let stored_payment = operation_context
        .payment_repository
        .find_payment(payment_id)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No payment with id {payment_id}"),
        })?;
    read_payment_document(&stored_payment)
}

/// Stores the payment as it is now, keeping the columns the list filters by in step.
pub async fn save_payment(
    operation_context: &OperationContext,
    payment: &PaymentDetail,
    created_at_unix_ms: i64,
) -> Result<(), OperationError> {
    let document_json = serde_json::to_string(payment)
        .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
    operation_context
        .payment_repository
        .save_payment(PaymentRecord {
            payment_id: payment.summary.id.clone(),
            provider: payment.summary.provider.clone(),
            method_key: payment.method_key.clone(),
            status: payment.summary.status.as_str().to_owned(),
            currency: payment.summary.currency.clone(),
            document_json,
            created_at_unix_ms,
            updated_at_unix_ms: operation_context.clock.now_unix_ms(),
        })
        .await?;
    Ok(())
}

pub fn add_timeline_event(
    operation_context: &OperationContext,
    payment: &mut PaymentDetail,
    kind: &str,
    description: impl Into<String>,
) {
    payment.timeline.push(PaymentTimelineEvent {
        kind: kind.to_owned(),
        description: description.into(),
        created_at: sendmock_core::format_rfc3339(operation_context.clock.now_unix_ms()),
    });
}

/// How many payments went through each gateway or used each method.
pub async fn count_payments(
    operation_context: &OperationContext,
    count_column: PaymentCountColumn,
) -> Result<BTreeMap<String, u32>, OperationError> {
    Ok(operation_context
        .payment_repository
        .count_payments_by(count_column)
        .await?
        .into_iter()
        .map(|(counted_key, payment_count)| {
            (
                counted_key,
                u32::try_from(payment_count).unwrap_or(u32::MAX),
            )
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_gateway_names_its_ids_as_its_api_does() {
        let stripe_ids = build_provider_ids("stripe", "01ABCDEF2345");
        assert_eq!(stripe_ids["checkout_session"], "cs_test_01ABCDEF2345");
        assert_eq!(
            read_provider_reference("stripe", &stripe_ids).as_deref(),
            Some("cs_test_01ABCDEF2345")
        );
        assert_eq!(
            build_provider_ids("paypal", "01abcdef2345")["order"],
            "01ABCDEF23"
        );
        let custom_ids = build_provider_ids("nagad", "01ABCDEF2345");
        assert_eq!(
            read_provider_reference("nagad", &custom_ids).as_deref(),
            Some("NAGAD-01ABCDEF2345")
        );
    }
}
