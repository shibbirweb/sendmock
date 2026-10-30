use rusqlite::Connection;
use sendmock_store::{Database, DatabaseLocation, EMBEDDED_MIGRATIONS, StoreError};

async fn save_setting(database: &Database, key: &str, value: &str) -> Result<(), StoreError> {
    let key = key.to_owned();
    let value = value.to_owned();
    database
        .write(move |connection| {
            connection.execute(
                "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, 0)",
                [key, value],
            )?;
            Ok(())
        })
        .await
}

async fn read_setting(database: &Database, key: &str) -> Result<Option<String>, StoreError> {
    let key = key.to_owned();
    database
        .read(move |connection| {
            let mut statement = connection.prepare("SELECT value FROM settings WHERE key = ?1")?;
            let mut rows = statement.query([key])?;
            Ok(match rows.next()? {
                Some(row) => Some(row.get(0)?),
                None => None,
            })
        })
        .await
}

#[tokio::test]
async fn a_file_database_uses_wal_and_keeps_data_across_a_restart()
-> Result<(), Box<dyn std::error::Error>> {
    let database_folder = tempfile::tempdir()?;
    let location = DatabaseLocation::File(database_folder.path().join("sendmock.db"));

    let database = Database::open(location.clone(), EMBEDDED_MIGRATIONS)?;
    save_setting(&database, "retention_days", "7").await?;
    let journal_mode: String = database
        .read(|connection| {
            Ok(connection.pragma_query_value(None, "journal_mode", |row| row.get(0))?)
        })
        .await?;
    drop(database);
    let reopened_database = Database::open(location, EMBEDDED_MIGRATIONS)?;

    assert_eq!(journal_mode, "wal");
    assert_eq!(
        read_setting(&reopened_database, "retention_days").await?,
        Some("7".to_owned())
    );
    Ok(())
}

#[tokio::test]
async fn readers_see_what_the_writer_wrote_in_memory() -> Result<(), StoreError> {
    let database = Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)?;

    save_setting(&database, "theme", "dark").await?;

    assert_eq!(
        read_setting(&database, "theme").await?,
        Some("dark".to_owned())
    );
    Ok(())
}

#[tokio::test]
async fn two_in_memory_databases_share_nothing() -> Result<(), StoreError> {
    let first_database = Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)?;
    let second_database = Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)?;

    save_setting(&first_database, "theme", "dark").await?;

    assert_eq!(read_setting(&second_database, "theme").await?, None);
    Ok(())
}

#[test]
fn refuses_a_database_from_a_newer_version_and_leaves_it_untouched()
-> Result<(), Box<dyn std::error::Error>> {
    let database_folder = tempfile::tempdir()?;
    let database_file_path = database_folder.path().join("sendmock.db");
    Connection::open(&database_file_path)?.pragma_update(None, "user_version", 99)?;

    let open_result = Database::open(
        DatabaseLocation::File(database_file_path.clone()),
        EMBEDDED_MIGRATIONS,
    );

    assert!(matches!(
        open_result,
        Err(StoreError::NewerSchema {
            found_version: 99,
            ..
        })
    ));
    let user_version: u32 =
        Connection::open(&database_file_path)?
            .pragma_query_value(None, "user_version", |row| row.get(0))?;
    assert_eq!(user_version, 99);
    Ok(())
}

#[tokio::test]
async fn creates_missing_folders_and_reports_its_size() -> Result<(), Box<dyn std::error::Error>> {
    let database_folder = tempfile::tempdir()?;
    let location = DatabaseLocation::File(database_folder.path().join("nested/folder/sendmock.db"));

    let database = Database::open(location.clone(), EMBEDDED_MIGRATIONS)?;

    assert_eq!(database.location(), &location);
    assert!(database.size_bytes().await? > 0);
    Ok(())
}
