use std::sync::Arc;

use rusqlite::{Connection, OptionalExtension, Row, params};

use super::rule_order::{move_rule_in_order, next_position, renumber_rules};
use super::{RuleMoveDirection, SmsOutcomeRuleRecord};
use crate::{Database, StoreError};

const RULES_TABLE: &str = "sms_outcome_rules";
const RULE_COLUMNS: &str = "id, position, match_field, pattern, outcome, error_code, delay_seconds, note, is_enabled, created_by, created_at";

/// Custom outcome numbers, kept in order so the first enabled match is easy to find.
#[derive(Clone)]
pub struct SmsOutcomeRuleRepository {
    database: Arc<Database>,
}

impl SmsOutcomeRuleRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn list_rules(&self) -> Result<Vec<SmsOutcomeRuleRecord>, StoreError> {
        self.database
            .read(|connection| Ok(select_rules_in_order(connection)?))
            .await
    }

    pub async fn find_rule(
        &self,
        rule_id: &str,
    ) -> Result<Option<SmsOutcomeRuleRecord>, StoreError> {
        let rule_id = rule_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("SELECT {RULE_COLUMNS} FROM sms_outcome_rules WHERE id = ?1"),
                        [rule_id],
                        read_rule_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Adds the rule at the end of the order and answers it with its position.
    pub async fn insert_rule(
        &self,
        new_rule: SmsOutcomeRuleRecord,
    ) -> Result<SmsOutcomeRuleRecord, StoreError> {
        self.database
            .write(move |connection| {
                let stored_rule = SmsOutcomeRuleRecord {
                    position: next_position(connection, RULES_TABLE)?,
                    ..new_rule
                };
                connection.execute(
                    &format!("INSERT INTO sms_outcome_rules ({RULE_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)"),
                    params![
                        stored_rule.rule_id,
                        stored_rule.position,
                        stored_rule.match_field,
                        stored_rule.pattern,
                        stored_rule.outcome,
                        stored_rule.error_code,
                        stored_rule.delay_seconds,
                        stored_rule.note,
                        stored_rule.is_enabled,
                        stored_rule.created_by,
                        stored_rule.created_at_unix_ms,
                    ],
                )?;
                Ok(stored_rule)
            })
            .await
    }

    /// Saves the editable fields; the position and creator stay. False when the rule is gone.
    pub async fn update_rule(
        &self,
        changed_rule: SmsOutcomeRuleRecord,
    ) -> Result<bool, StoreError> {
        self.database
            .write(move |connection| {
                let changed_count = connection.execute(
                    "UPDATE sms_outcome_rules SET match_field = ?2, pattern = ?3, outcome = ?4, error_code = ?5, delay_seconds = ?6, note = ?7, is_enabled = ?8 WHERE id = ?1",
                    params![
                        changed_rule.rule_id,
                        changed_rule.match_field,
                        changed_rule.pattern,
                        changed_rule.outcome,
                        changed_rule.error_code,
                        changed_rule.delay_seconds,
                        changed_rule.note,
                        changed_rule.is_enabled,
                    ],
                )?;
                Ok(changed_count > 0)
            })
            .await
    }

    /// Deletes the rule and closes the gap it leaves in the order.
    pub async fn delete_rule(&self, rule_id: &str) -> Result<bool, StoreError> {
        let rule_id = rule_id.to_owned();
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let deleted_count = transaction
                    .execute("DELETE FROM sms_outcome_rules WHERE id = ?1", [rule_id])?;
                renumber_rules(&transaction, RULES_TABLE)?;
                transaction.commit()?;
                Ok(deleted_count > 0)
            })
            .await
    }

    /// Swaps the rule with its neighbour; false when the rule is gone. Moving the first rule up
    /// or the last one down changes nothing.
    pub async fn move_rule(
        &self,
        rule_id: &str,
        move_direction: RuleMoveDirection,
    ) -> Result<bool, StoreError> {
        let rule_id = rule_id.to_owned();
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let is_found =
                    move_rule_in_order(&transaction, RULES_TABLE, &rule_id, move_direction)?;
                transaction.commit()?;
                Ok(is_found)
            })
            .await
    }
}

fn select_rules_in_order(connection: &Connection) -> rusqlite::Result<Vec<SmsOutcomeRuleRecord>> {
    let mut statement = connection.prepare(&format!(
        "SELECT {RULE_COLUMNS} FROM sms_outcome_rules ORDER BY position, created_at"
    ))?;
    statement.query_map([], read_rule_row)?.collect()
}

fn read_rule_row(row: &Row<'_>) -> rusqlite::Result<SmsOutcomeRuleRecord> {
    Ok(SmsOutcomeRuleRecord {
        rule_id: row.get(0)?,
        position: row.get(1)?,
        match_field: row.get(2)?,
        pattern: row.get(3)?,
        outcome: row.get(4)?,
        error_code: row.get(5)?,
        delay_seconds: row.get(6)?,
        note: row.get(7)?,
        is_enabled: row.get(8)?,
        created_by: row.get(9)?,
        created_at_unix_ms: row.get(10)?,
    })
}
