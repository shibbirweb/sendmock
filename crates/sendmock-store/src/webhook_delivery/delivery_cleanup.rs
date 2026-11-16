use rusqlite::{OptionalExtension, params_from_iter};

use super::delivery_list_query::build_conditions;
use super::{WebhookDeliveryFilter, WebhookDeliveryRepository};
use crate::StoreError;

/// Queued, being sent, or failed with a retry still due: the dispatcher still owns the row.
const IN_FLIGHT_CONDITION: &str =
    "(status IN ('pending', 'in_flight') OR (status = 'failed' AND next_attempt_at IS NOT NULL))";

/// What deleting one delivery did.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeliveryDeleteOutcome {
    Deleted,
    /// Still queued or waiting for a retry, so it stays until it finishes or is cancelled.
    InFlight,
    /// There was no such delivery.
    Missing,
}

impl WebhookDeliveryRepository {
    /// Deletes a finished delivery; one in flight stays.
    pub async fn delete_finished_delivery(
        &self,
        delivery_id: &str,
    ) -> Result<DeliveryDeleteOutcome, StoreError> {
        let delivery_id = delivery_id.to_owned();
        self.database()
            .write(move |connection| {
                let is_in_flight: Option<bool> = connection
                    .query_row(
                        &format!(
                            "SELECT {IN_FLIGHT_CONDITION} FROM webhook_deliveries WHERE id = ?1"
                        ),
                        [&delivery_id],
                        |row| row.get(0),
                    )
                    .optional()?;
                Ok(match is_in_flight {
                    None => DeliveryDeleteOutcome::Missing,
                    Some(true) => DeliveryDeleteOutcome::InFlight,
                    Some(false) => {
                        connection.execute(
                            "DELETE FROM webhook_deliveries WHERE id = ?1",
                            [&delivery_id],
                        )?;
                        DeliveryDeleteOutcome::Deleted
                    }
                })
            })
            .await
    }

    /// Deletes the finished deliveries the list's filter matches; answers how many went.
    pub async fn delete_finished_deliveries(
        &self,
        filter: WebhookDeliveryFilter,
    ) -> Result<u64, StoreError> {
        self.database()
            .write(move |connection| {
                let (condition_text, parameters) = build_conditions(&filter);
                let deleted_count = connection.execute(
                    &format!(
                        "DELETE FROM webhook_deliveries WHERE {condition_text} AND NOT {IN_FLIGHT_CONDITION}"
                    ),
                    params_from_iter(parameters.iter()),
                )?;
                Ok(u64::try_from(deleted_count).unwrap_or_default())
            })
            .await
    }
}
