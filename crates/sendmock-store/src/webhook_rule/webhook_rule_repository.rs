use std::sync::Arc;

use rusqlite::{Connection, OptionalExtension, Row, params};

use super::WebhookRuleRecord;
use crate::{Database, RuleMoveDirection, StoreError};

const RULE_COLUMNS: &str =
    "id, position, name, endpoint_id, events, filter, is_enabled, created_by, created_at";

/// Webhook rules, kept in firing order.
#[derive(Clone)]
pub struct WebhookRuleRepository {
    database: Arc<Database>,
}

impl WebhookRuleRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    pub async fn list_rules(&self) -> Result<Vec<WebhookRuleRecord>, StoreError> {
        self.database
            .read(|connection| Ok(select_rules_in_order(connection)?))
            .await
    }

    pub async fn find_rule(&self, rule_id: &str) -> Result<Option<WebhookRuleRecord>, StoreError> {
        let rule_id = rule_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("SELECT {RULE_COLUMNS} FROM webhook_rules WHERE id = ?1"),
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
        new_rule: WebhookRuleRecord,
    ) -> Result<WebhookRuleRecord, StoreError> {
        self.database
            .write(move |connection| {
                let rule_count: u32 =
                    connection.query_row("SELECT COUNT(*) FROM webhook_rules", [], |row| row.get(0))?;
                let stored_rule = WebhookRuleRecord {
                    position: rule_count + 1,
                    ..new_rule
                };
                connection.execute(
                    &format!("INSERT INTO webhook_rules ({RULE_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"),
                    params![
                        stored_rule.rule_id,
                        stored_rule.position,
                        stored_rule.name,
                        stored_rule.endpoint_id,
                        stored_rule.events_json,
                        stored_rule.filter_json,
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
    pub async fn update_rule(&self, changed_rule: WebhookRuleRecord) -> Result<bool, StoreError> {
        self.database
            .write(move |connection| {
                let changed_count = connection.execute(
                    "UPDATE webhook_rules SET name = ?2, endpoint_id = ?3, events = ?4, filter = ?5, is_enabled = ?6 WHERE id = ?1",
                    params![
                        changed_rule.rule_id,
                        changed_rule.name,
                        changed_rule.endpoint_id,
                        changed_rule.events_json,
                        changed_rule.filter_json,
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
                let deleted_count =
                    transaction.execute("DELETE FROM webhook_rules WHERE id = ?1", [rule_id])?;
                renumber_rules(&transaction)?;
                transaction.commit()?;
                Ok(deleted_count > 0)
            })
            .await
    }

    /// Deletes every rule of a deleted endpoint and closes the gaps.
    pub async fn delete_endpoint_rules(&self, endpoint_id: &str) -> Result<usize, StoreError> {
        let endpoint_id = endpoint_id.to_owned();
        self.database
            .write(move |connection| {
                let transaction = connection.transaction()?;
                let deleted_count = transaction.execute(
                    "DELETE FROM webhook_rules WHERE endpoint_id = ?1",
                    [endpoint_id],
                )?;
                renumber_rules(&transaction)?;
                transaction.commit()?;
                Ok(deleted_count)
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
                let mut ordered_ids: Vec<String> = select_rules_in_order(&transaction)?
                    .into_iter()
                    .map(|rule| rule.rule_id)
                    .collect();
                let Some(rule_index) = ordered_ids
                    .iter()
                    .position(|ordered_id| *ordered_id == rule_id)
                else {
                    return Ok(false);
                };
                let neighbour_index = match move_direction {
                    RuleMoveDirection::Up => rule_index.checked_sub(1),
                    RuleMoveDirection::Down => {
                        Some(rule_index + 1).filter(|index| *index < ordered_ids.len())
                    }
                };
                if let Some(neighbour_index) = neighbour_index {
                    ordered_ids.swap(rule_index, neighbour_index);
                    write_positions(&transaction, &ordered_ids)?;
                }
                transaction.commit()?;
                Ok(true)
            })
            .await
    }
}

fn select_rules_in_order(connection: &Connection) -> rusqlite::Result<Vec<WebhookRuleRecord>> {
    let mut statement = connection.prepare(&format!(
        "SELECT {RULE_COLUMNS} FROM webhook_rules ORDER BY position, created_at"
    ))?;
    statement.query_map([], read_rule_row)?.collect()
}

fn renumber_rules(connection: &Connection) -> rusqlite::Result<()> {
    let ordered_ids: Vec<String> = select_rules_in_order(connection)?
        .into_iter()
        .map(|rule| rule.rule_id)
        .collect();
    write_positions(connection, &ordered_ids)
}

fn write_positions(connection: &Connection, ordered_ids: &[String]) -> rusqlite::Result<()> {
    let mut statement =
        connection.prepare("UPDATE webhook_rules SET position = ?1 WHERE id = ?2")?;
    for (position, rule_id) in (1_i64..).zip(ordered_ids) {
        statement.execute(params![position, rule_id])?;
    }
    Ok(())
}

fn read_rule_row(row: &Row<'_>) -> rusqlite::Result<WebhookRuleRecord> {
    Ok(WebhookRuleRecord {
        rule_id: row.get(0)?,
        position: row.get(1)?,
        name: row.get(2)?,
        endpoint_id: row.get(3)?,
        events_json: row.get(4)?,
        filter_json: row.get(5)?,
        is_enabled: row.get(6)?,
        created_by: row.get(7)?,
        created_at_unix_ms: row.get(8)?,
    })
}
