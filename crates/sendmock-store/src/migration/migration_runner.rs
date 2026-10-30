use std::path::Path;

use rusqlite::Connection;

use super::Migration;
use crate::StoreError;

/// Brings the schema up to the last migration. A schema newer than any known migration is
/// refused untouched; an existing file is copied to `<file>.bak-<schema version>` first.
pub fn apply_migrations(
    connection: &mut Connection,
    migrations: &[Migration],
    database_file_path: Option<&Path>,
) -> Result<(), StoreError> {
    let current_version = read_schema_version(connection)?;
    let supported_version = migrations
        .last()
        .map_or(0, |migration| migration.schema_version);
    if current_version > supported_version {
        return Err(StoreError::NewerSchema {
            found_version: current_version,
            supported_version,
        });
    }
    let pending_migrations: Vec<&Migration> = migrations
        .iter()
        .filter(|migration| migration.schema_version > current_version)
        .collect();
    if pending_migrations.is_empty() {
        return Ok(());
    }
    if let Some(database_file_path) = database_file_path.filter(|_| current_version > 0) {
        back_up_database(connection, database_file_path, current_version)?;
    }
    for migration in pending_migrations {
        let transaction = connection.transaction()?;
        transaction.execute_batch(migration.sql)?;
        transaction.pragma_update(None, "user_version", migration.schema_version)?;
        transaction.commit()?;
    }
    Ok(())
}

pub fn read_schema_version(connection: &Connection) -> Result<u32, StoreError> {
    Ok(connection.pragma_query_value(None, "user_version", |row| row.get(0))?)
}

fn back_up_database(
    connection: &Connection,
    database_file_path: &Path,
    schema_version: u32,
) -> Result<(), StoreError> {
    let backup_file_path = format!("{}.bak-{schema_version}", database_file_path.display());
    // VACUUM INTO writes a consistent copy even while other connections use the WAL.
    connection.execute("VACUUM INTO ?1", [backup_file_path])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIRST_MIGRATION: Migration = Migration {
        schema_version: 1,
        sql: "CREATE TABLE first_table (id INTEGER PRIMARY KEY) STRICT;",
    };
    const SECOND_MIGRATION: Migration = Migration {
        schema_version: 2,
        sql: "CREATE TABLE second_table (id INTEGER PRIMARY KEY) STRICT;",
    };

    fn count_tables(connection: &Connection) -> rusqlite::Result<i64> {
        connection.query_row(
            "SELECT count(*) FROM sqlite_schema WHERE type = 'table'",
            [],
            |row| row.get(0),
        )
    }

    #[test]
    fn applies_every_migration_to_a_new_database() -> Result<(), StoreError> {
        let mut connection = Connection::open_in_memory()?;

        apply_migrations(&mut connection, &[FIRST_MIGRATION, SECOND_MIGRATION], None)?;

        assert_eq!(read_schema_version(&connection)?, 2);
        assert_eq!(count_tables(&connection)?, 2);
        Ok(())
    }

    #[test]
    fn running_again_changes_nothing() -> Result<(), StoreError> {
        let mut connection = Connection::open_in_memory()?;
        apply_migrations(&mut connection, &[FIRST_MIGRATION], None)?;

        apply_migrations(&mut connection, &[FIRST_MIGRATION], None)?;

        assert_eq!(read_schema_version(&connection)?, 1);
        assert_eq!(count_tables(&connection)?, 1);
        Ok(())
    }

    #[test]
    fn refuses_a_schema_newer_than_this_version_knows() -> Result<(), StoreError> {
        let mut connection = Connection::open_in_memory()?;
        connection.pragma_update(None, "user_version", 7)?;

        let migration_result = apply_migrations(&mut connection, &[FIRST_MIGRATION], None);

        assert!(matches!(
            migration_result,
            Err(StoreError::NewerSchema {
                found_version: 7,
                supported_version: 1
            })
        ));
        assert_eq!(count_tables(&connection)?, 0);
        Ok(())
    }

    #[test]
    fn backs_up_an_existing_file_before_migrating_it() -> Result<(), Box<dyn std::error::Error>> {
        let database_folder = tempfile::tempdir()?;
        let database_file_path = database_folder.path().join("sendmock.db");
        let mut connection = Connection::open(&database_file_path)?;
        apply_migrations(
            &mut connection,
            &[FIRST_MIGRATION],
            Some(&database_file_path),
        )?;

        apply_migrations(
            &mut connection,
            &[FIRST_MIGRATION, SECOND_MIGRATION],
            Some(&database_file_path),
        )?;

        let backup_file_path = database_folder.path().join("sendmock.db.bak-1");
        let backup_connection = Connection::open(&backup_file_path)?;
        assert_eq!(read_schema_version(&backup_connection)?, 1);
        assert_eq!(read_schema_version(&connection)?, 2);
        Ok(())
    }

    #[test]
    fn does_not_back_up_a_new_file() -> Result<(), Box<dyn std::error::Error>> {
        let database_folder = tempfile::tempdir()?;
        let database_file_path = database_folder.path().join("sendmock.db");
        let mut connection = Connection::open(&database_file_path)?;

        apply_migrations(
            &mut connection,
            &[FIRST_MIGRATION],
            Some(&database_file_path),
        )?;

        assert!(!database_folder.path().join("sendmock.db.bak-0").exists());
        Ok(())
    }
}
