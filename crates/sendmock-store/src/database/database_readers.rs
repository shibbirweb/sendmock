use std::sync::{Arc, Mutex, PoisonError};

use rusqlite::Connection;
use tokio::sync::Semaphore;

use crate::StoreError;

/// A small pool of read-only connections; each read runs on a blocking thread so the async
/// workers never wait on SQLite.
pub struct DatabaseReaders {
    idle_connections: Arc<Mutex<Vec<Connection>>>,
    available_connections: Arc<Semaphore>,
}

impl DatabaseReaders {
    pub fn new(connections: Vec<Connection>) -> Self {
        Self {
            available_connections: Arc::new(Semaphore::new(connections.len())),
            idle_connections: Arc::new(Mutex::new(connections)),
        }
    }

    pub async fn read<T, Operation>(&self, operation: Operation) -> Result<T, StoreError>
    where
        T: Send + 'static,
        Operation: FnOnce(&Connection) -> Result<T, StoreError> + Send + 'static,
    {
        let permit = Arc::clone(&self.available_connections)
            .acquire_owned()
            .await
            .map_err(|closed| StoreError::ReadInterrupted(closed.to_string()))?;
        let idle_connections = Arc::clone(&self.idle_connections);
        tokio::task::spawn_blocking(move || {
            let connection = idle_connections
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .pop()
                .ok_or_else(|| StoreError::ReadInterrupted("no idle connection".to_owned()))?;
            let read_result = operation(&connection);
            idle_connections
                .lock()
                .unwrap_or_else(PoisonError::into_inner)
                .push(connection);
            drop(permit);
            read_result
        })
        .await
        .map_err(|join_error| StoreError::ReadInterrupted(join_error.to_string()))?
    }
}
