use rusqlite::params_from_iter;

use super::payment_repository::build_conditions;
use super::{PaymentListFilter, PaymentRepository};
use crate::StoreError;

impl PaymentRepository {
    /// Deletes one payment; its provider objects go with it, and its checkout session is the
    /// payment itself. Answers whether it existed.
    pub async fn delete_payment(&self, payment_id: &str) -> Result<bool, StoreError> {
        let payment_id = payment_id.to_owned();
        self.database()
            .write(move |connection| {
                Ok(connection.execute("DELETE FROM payments WHERE id = ?1", [payment_id])? > 0)
            })
            .await
    }

    /// Deletes the payments the list's filter matches; answers how many went.
    pub async fn delete_matching_payments(
        &self,
        filter: PaymentListFilter,
    ) -> Result<u64, StoreError> {
        self.database()
            .write(move |connection| {
                let (condition_text, parameters) = build_conditions(&filter);
                let deleted_count = connection.execute(
                    &format!("DELETE FROM payments WHERE {condition_text}"),
                    params_from_iter(parameters.iter()),
                )?;
                Ok(u64::try_from(deleted_count).unwrap_or_default())
            })
            .await
    }
}
