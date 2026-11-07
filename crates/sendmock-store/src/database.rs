mod connection_settings;
mod database_checkpointer;
mod database_readers;
mod database_writer;

pub(crate) use connection_settings::BUSY_TIMEOUT;
pub use database_checkpointer::CheckpointProgress;

use rusqlite::Connection;

use crate::migration::apply_migrations;
use crate::{DatabaseLocation, Migration, StoreError};
use connection_settings::{
    connection_target, open_checkpoint_connection, open_read_connection, open_write_connection,
};
use database_checkpointer::DatabaseCheckpointer;
use database_readers::DatabaseReaders;
use database_writer::DatabaseWriter;

const READ_CONNECTION_COUNT: usize = 4;

/// The SQLite database: one writer that applies writes in order and a pool of readers.
pub struct Database {
    location: DatabaseLocation,
    writer: DatabaseWriter,
    readers: DatabaseReaders,
    /// Only file databases have a write-ahead log to copy.
    checkpointer: Option<DatabaseCheckpointer>,
}

impl Database {
    /// Opens or creates the database and applies the pending migrations. Blocking: call it
    /// at startup or on a blocking thread.
    pub fn open(location: DatabaseLocation, migrations: &[Migration]) -> Result<Self, StoreError> {
        let connection_target = connection_target(&location);
        let mut write_connection = open_write_connection(&connection_target, &location)?;
        let database_file_path = match &location {
            DatabaseLocation::File(file_path) => Some(file_path.as_path()),
            DatabaseLocation::InMemory => None,
        };
        apply_migrations(&mut write_connection, migrations, database_file_path)?;
        let read_connections = (0..READ_CONNECTION_COUNT)
            .map(|_| open_read_connection(&connection_target))
            .collect::<Result<Vec<_>, _>>()?;
        let checkpointer = match &location {
            DatabaseLocation::File(_) => Some(DatabaseCheckpointer::new(
                open_checkpoint_connection(&connection_target)?,
            )),
            DatabaseLocation::InMemory => None,
        };
        Ok(Self {
            location,
            writer: DatabaseWriter::start(write_connection),
            readers: DatabaseReaders::new(read_connections),
            checkpointer,
        })
    }

    pub fn location(&self) -> &DatabaseLocation {
        &self.location
    }

    pub async fn write<T, Operation>(&self, operation: Operation) -> Result<T, StoreError>
    where
        T: Send + 'static,
        Operation: FnOnce(&mut Connection) -> Result<T, StoreError> + Send + 'static,
    {
        self.writer.write(operation).await
    }

    pub async fn read<T, Operation>(&self, operation: Operation) -> Result<T, StoreError>
    where
        T: Send + 'static,
        Operation: FnOnce(&Connection) -> Result<T, StoreError> + Send + 'static,
    {
        self.readers.read(operation).await
    }

    /// Copies what it can of the write-ahead log into the database file without waiting for,
    /// or holding up, any write. An in-memory database has no log and answers `None`.
    pub async fn checkpoint_without_blocking_writes(
        &self,
    ) -> Result<Option<CheckpointProgress>, StoreError> {
        match &self.checkpointer {
            Some(checkpointer) => Ok(Some(checkpointer.checkpoint_passively().await?)),
            None => Ok(None),
        }
    }

    pub async fn size_bytes(&self) -> Result<u64, StoreError> {
        let size_bytes: i64 = self
            .read(|connection| {
                Ok(connection.query_row(
                    "SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()",
                    [],
                    |row| row.get(0),
                )?)
            })
            .await?;
        Ok(u64::try_from(size_bytes).unwrap_or_default())
    }
}
