mod connection_settings;
mod database_readers;
mod database_writer;

use rusqlite::Connection;

use crate::migration::apply_migrations;
use crate::{DatabaseLocation, Migration, StoreError};
use connection_settings::{connection_target, open_read_connection, open_write_connection};
use database_readers::DatabaseReaders;
use database_writer::DatabaseWriter;

const READ_CONNECTION_COUNT: usize = 4;

/// The SQLite database: one writer that applies writes in order and a pool of readers.
pub struct Database {
    location: DatabaseLocation,
    writer: DatabaseWriter,
    readers: DatabaseReaders,
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
        Ok(Self {
            location,
            writer: DatabaseWriter::start(write_connection),
            readers: DatabaseReaders::new(read_connections),
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
