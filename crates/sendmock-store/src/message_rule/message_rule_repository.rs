use std::sync::Arc;

use rusqlite::{Connection, OptionalExtension, Row, params};

use super::{MessageRuleKind, MessageRuleRecord};
use crate::outcome_rule::{move_rule_in_order, next_position, renumber_rules};
use crate::{Database, RuleMoveDirection, StoreError};

const RULE_COLUMNS: &str = "id, position, name, filter_json, action, is_enabled, created_at";

/// One kind of message rule (tag or forward), kept in the order they run.
#[derive(Clone)]
pub struct MessageRuleRepository {
    database: Arc<Database>,
    rule_kind: MessageRuleKind,
}

impl MessageRuleRepository {
    pub fn new(database: Arc<Database>, rule_kind: MessageRuleKind) -> Self {
        Self {
            database,
            rule_kind,
        }
    }

    pub async fn list_rules(&self) -> Result<Vec<MessageRuleRecord>, StoreError> {
        let table_name = self.rule_kind.table_name();
        self.database
            .read(move |connection| Ok(select_rules_in_order(connection, table_name)?))
            .await
    }

    pub async fn find_rule(&self, rule_id: &str) -> Result<Option<MessageRuleRecord>, StoreError> {
        let (table_name, rule_id) = (self.rule_kind.table_name(), rule_id.to_owned());
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("SELECT {RULE_COLUMNS} FROM {table_name} WHERE id = ?1"),
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
        new_rule: MessageRuleRecord,
    ) -> Result<MessageRuleRecord, StoreError> {
        let table_name = self.rule_kind.table_name();
        self.database
            .write(move |connection| {
                let stored_rule = MessageRuleRecord {
                    position: next_position(connection, table_name)?,
                    ..new_rule
                };
                connection.execute(
                    &format!("INSERT INTO {table_name} ({RULE_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"),
                    params![
                        stored_rule.rule_id,
                        stored_rule.position,
                        stored_rule.name,
                        stored_rule.filter_json,
                        stored_rule.action,
                        stored_rule.is_enabled,
                        stored_rule.created_at_unix_ms,
                    ],
                )?;
                Ok(stored_rule)
            })
            .await
    }

    /// Saves the name, filter, action and switch; false when the rule is gone.
    pub async fn update_rule(&self, changed_rule: MessageRuleRecord) -> Result<bool, StoreError> {
        let table_name = self.rule_kind.table_name();
        self.database
            .write(move |connection| {
                let changed_count = connection.execute(
                    &format!("UPDATE {table_name} SET name = ?2, filter_json = ?3, action = ?4, is_enabled = ?5 WHERE id = ?1"),
                    params![
                        changed_rule.rule_id,
                        changed_rule.name,
                        changed_rule.filter_json,
                        changed_rule.action,
                        changed_rule.is_enabled,
                    ],
                )?;
                Ok(changed_count > 0)
            })
            .await
    }

    /// Deletes the rule and closes the gap it leaves in the order.
    pub async fn delete_rule(&self, rule_id: &str) -> Result<bool, StoreError> {
        let (table_name, rule_id) = (self.rule_kind.table_name(), rule_id.to_owned());
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let deleted_count = transaction.execute(
                    &format!("DELETE FROM {table_name} WHERE id = ?1"),
                    [rule_id],
                )?;
                renumber_rules(&transaction, table_name)?;
                transaction.commit()?;
                Ok(deleted_count > 0)
            })
            .await
    }

    /// Swaps the rule with its neighbour; false when the rule is gone.
    pub async fn move_rule(
        &self,
        rule_id: &str,
        move_direction: RuleMoveDirection,
    ) -> Result<bool, StoreError> {
        let (table_name, rule_id) = (self.rule_kind.table_name(), rule_id.to_owned());
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let is_found =
                    move_rule_in_order(&transaction, table_name, &rule_id, move_direction)?;
                transaction.commit()?;
                Ok(is_found)
            })
            .await
    }
}

fn select_rules_in_order(
    connection: &Connection,
    table_name: &str,
) -> rusqlite::Result<Vec<MessageRuleRecord>> {
    let mut statement = connection.prepare(&format!(
        "SELECT {RULE_COLUMNS} FROM {table_name} ORDER BY position, created_at"
    ))?;
    statement.query_map([], read_rule_row)?.collect()
}

fn read_rule_row(row: &Row<'_>) -> rusqlite::Result<MessageRuleRecord> {
    Ok(MessageRuleRecord {
        rule_id: row.get(0)?,
        position: row.get(1)?,
        name: row.get(2)?,
        filter_json: row.get(3)?,
        action: row.get(4)?,
        is_enabled: row.get(5)?,
        created_at_unix_ms: row.get(6)?,
    })
}
