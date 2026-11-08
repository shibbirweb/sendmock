use rusqlite::{Connection, params};

use super::RuleMoveDirection;

/// Rule IDs of an outcome rule table in the order they are checked.
fn select_ids_in_order(connection: &Connection, table_name: &str) -> rusqlite::Result<Vec<String>> {
    let mut statement = connection.prepare(&format!(
        "SELECT id FROM {table_name} ORDER BY position, created_at"
    ))?;
    statement.query_map([], |row| row.get(0))?.collect()
}

/// The position a new rule gets: after every existing one.
pub fn next_position(connection: &Connection, table_name: &str) -> rusqlite::Result<u32> {
    let rule_count: u32 =
        connection.query_row(&format!("SELECT COUNT(*) FROM {table_name}"), [], |row| {
            row.get(0)
        })?;
    Ok(rule_count + 1)
}

/// Positions 1..n in the current order, so the order has no gaps.
pub fn renumber_rules(connection: &Connection, table_name: &str) -> rusqlite::Result<()> {
    let ordered_ids = select_ids_in_order(connection, table_name)?;
    write_positions(connection, table_name, &ordered_ids)
}

/// Swaps the rule with its neighbour; false when the rule is gone. Moving the first rule up
/// or the last one down changes nothing.
pub fn move_rule_in_order(
    connection: &Connection,
    table_name: &str,
    rule_id: &str,
    move_direction: RuleMoveDirection,
) -> rusqlite::Result<bool> {
    let mut ordered_ids = select_ids_in_order(connection, table_name)?;
    let Some(rule_index) = ordered_ids
        .iter()
        .position(|ordered_id| ordered_id == rule_id)
    else {
        return Ok(false);
    };
    let neighbour_index = match move_direction {
        RuleMoveDirection::Up => rule_index.checked_sub(1),
        RuleMoveDirection::Down => Some(rule_index + 1).filter(|index| *index < ordered_ids.len()),
    };
    if let Some(neighbour_index) = neighbour_index {
        ordered_ids.swap(rule_index, neighbour_index);
        write_positions(connection, table_name, &ordered_ids)?;
    }
    Ok(true)
}

fn write_positions(
    connection: &Connection,
    table_name: &str,
    ordered_ids: &[String],
) -> rusqlite::Result<()> {
    let mut statement = connection.prepare(&format!(
        "UPDATE {table_name} SET position = ?1 WHERE id = ?2"
    ))?;
    for (position, rule_id) in (1_i64..).zip(ordered_ids) {
        statement.execute(params![position, rule_id])?;
    }
    Ok(())
}
