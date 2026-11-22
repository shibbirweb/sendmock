use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use crate::{Database, StoreError};

const SUBACCOUNT_COLUMNS: &str = "account_sid, friendly_name, auth_token, status, debugger_url, created_by, created_at, updated_at";

/// A Twilio subaccount as stored; `status` is `active`, `suspended` or `closed`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TwilioSubaccountRecord {
    pub account_sid: String,
    pub friendly_name: String,
    pub auth_token: String,
    pub status: String,
    pub debugger_url: Option<String>,
    pub created_by: String,
    pub created_at_unix_ms: i64,
    pub updated_at_unix_ms: i64,
}

/// Subaccounts of the Twilio provider's main account, oldest first.
#[derive(Clone)]
pub struct TwilioSubaccountRepository {
    database: Arc<Database>,
}

fn read_subaccount_row(row: &Row<'_>) -> rusqlite::Result<TwilioSubaccountRecord> {
    Ok(TwilioSubaccountRecord {
        account_sid: row.get(0)?,
        friendly_name: row.get(1)?,
        auth_token: row.get(2)?,
        status: row.get(3)?,
        debugger_url: row.get(4)?,
        created_by: row.get(5)?,
        created_at_unix_ms: row.get(6)?,
        updated_at_unix_ms: row.get(7)?,
    })
}

impl TwilioSubaccountRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn list_subaccounts(&self) -> Result<Vec<TwilioSubaccountRecord>, StoreError> {
        self.database
            .read(|connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {SUBACCOUNT_COLUMNS} FROM twilio_subaccounts ORDER BY created_at, rowid"
                ))?;
                let subaccounts = statement
                    .query_map([], read_subaccount_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(subaccounts)
            })
            .await
    }

    pub async fn find_subaccount(
        &self,
        account_sid: &str,
    ) -> Result<Option<TwilioSubaccountRecord>, StoreError> {
        let account_sid = account_sid.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!(
                            "SELECT {SUBACCOUNT_COLUMNS} FROM twilio_subaccounts WHERE account_sid = ?1"
                        ),
                        [account_sid],
                        read_subaccount_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Inserts a new subaccount or replaces the one with the same SID, keeping its creation.
    pub async fn save_subaccount(
        &self,
        subaccount: TwilioSubaccountRecord,
    ) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!(
                        "INSERT INTO twilio_subaccounts ({SUBACCOUNT_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) \
                         ON CONFLICT (account_sid) DO UPDATE SET friendly_name = excluded.friendly_name, auth_token = excluded.auth_token, \
                         status = excluded.status, debugger_url = excluded.debugger_url, updated_at = excluded.updated_at"
                    ),
                    params![
                        subaccount.account_sid,
                        subaccount.friendly_name,
                        subaccount.auth_token,
                        subaccount.status,
                        subaccount.debugger_url,
                        subaccount.created_by,
                        subaccount.created_at_unix_ms,
                        subaccount.updated_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn delete_subaccount(&self, account_sid: &str) -> Result<bool, StoreError> {
        let account_sid = account_sid.to_owned();
        self.database
            .write(move |connection| {
                Ok(connection.execute(
                    "DELETE FROM twilio_subaccounts WHERE account_sid = ?1",
                    [account_sid],
                )? > 0)
            })
            .await
    }

    /// Removes every subaccount, as a reset or a Replace import does.
    pub async fn delete_all_subaccounts(&self) -> Result<(), StoreError> {
        self.database
            .write(|connection| {
                connection.execute("DELETE FROM twilio_subaccounts", [])?;
                Ok(())
            })
            .await
    }
}
