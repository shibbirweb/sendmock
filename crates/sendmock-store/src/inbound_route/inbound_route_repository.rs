use std::sync::Arc;

use rusqlite::{OptionalExtension, Row, params};

use crate::{Database, StoreError};

const ROUTE_COLUMNS: &str = "id, priority, description, filter_json, actions_json, created_at";

/// A route as stored; the filter and actions are kept as the operations' JSON.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InboundRouteRecord {
    pub route_id: String,
    pub priority: i64,
    pub description: String,
    pub filter_json: String,
    pub actions_json: String,
    pub created_at_unix_ms: i64,
}

/// Inbound routes, read in the order they run.
#[derive(Clone)]
pub struct InboundRouteRepository {
    database: Arc<Database>,
}

fn read_route_row(row: &Row<'_>) -> rusqlite::Result<InboundRouteRecord> {
    Ok(InboundRouteRecord {
        route_id: row.get(0)?,
        priority: row.get(1)?,
        description: row.get(2)?,
        filter_json: row.get(3)?,
        actions_json: row.get(4)?,
        created_at_unix_ms: row.get(5)?,
    })
}

impl InboundRouteRepository {
    pub fn new(database: Arc<Database>) -> Self {
        Self { database }
    }

    /// Lower priority first, then the older route, as Mailgun runs them.
    pub async fn list_routes(&self) -> Result<Vec<InboundRouteRecord>, StoreError> {
        self.database
            .read(|connection| {
                let mut statement = connection.prepare(&format!(
                    "SELECT {ROUTE_COLUMNS} FROM inbound_routes ORDER BY priority, created_at, rowid"
                ))?;
                let routes = statement
                    .query_map([], read_route_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                Ok(routes)
            })
            .await
    }

    pub async fn find_route(
        &self,
        route_id: &str,
    ) -> Result<Option<InboundRouteRecord>, StoreError> {
        let route_id = route_id.to_owned();
        self.database
            .read(move |connection| {
                Ok(connection
                    .query_row(
                        &format!("SELECT {ROUTE_COLUMNS} FROM inbound_routes WHERE id = ?1"),
                        [route_id],
                        read_route_row,
                    )
                    .optional()?)
            })
            .await
    }

    /// Inserts a new route or replaces the one with the same id.
    pub async fn save_route(&self, route: InboundRouteRecord) -> Result<(), StoreError> {
        self.database
            .write(move |connection| {
                connection.execute(
                    &format!("INSERT OR REPLACE INTO inbound_routes ({ROUTE_COLUMNS}) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"),
                    params![
                        route.route_id,
                        route.priority,
                        route.description,
                        route.filter_json,
                        route.actions_json,
                        route.created_at_unix_ms,
                    ],
                )?;
                Ok(())
            })
            .await
    }

    pub async fn delete_route(&self, route_id: &str) -> Result<bool, StoreError> {
        let route_id = route_id.to_owned();
        self.database
            .write(move |connection| {
                Ok(connection.execute("DELETE FROM inbound_routes WHERE id = ?1", [route_id])? > 0)
            })
            .await
    }
}
