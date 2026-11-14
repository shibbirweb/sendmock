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

async fn save_many_settings(database: &Database, setting_count: usize) -> Result<(), StoreError> {
    database
        .write(move |connection| {
            let transaction = connection.transaction()?;
            for setting_number in 0..setting_count {
                transaction.execute(
                    "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, 0)",
                    [format!("bulk_{setting_number}"), "x".repeat(400)],
                )?;
            }
            transaction.commit()?;
            Ok(())
        })
        .await
}

// AC: PL-08.2
#[tokio::test]
async fn a_checkpoint_runs_while_the_writer_is_busy() -> Result<(), Box<dyn std::error::Error>> {
    let database_folder = tempfile::tempdir()?;
    let database = std::sync::Arc::new(Database::open(
        DatabaseLocation::File(database_folder.path().join("sendmock.db")),
        EMBEDDED_MIGRATIONS,
    )?);
    save_many_settings(&database, 500).await?;
    let (release_writer, writer_released) = std::sync::mpsc::channel::<()>();
    let (report_writer_busy, writer_busy) = tokio::sync::oneshot::channel::<()>();
    let writing_database = std::sync::Arc::clone(&database);
    let held_write = tokio::spawn(async move {
        writing_database
            .write(move |_connection| {
                let _ = report_writer_busy.send(());
                writer_released
                    .recv()
                    .map_err(|_| StoreError::WriterStopped)?;
                Ok(())
            })
            .await
    });
    writer_busy.await?;

    let checkpoint = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        database.checkpoint_without_blocking_writes(),
    )
    .await;
    release_writer.send(())?;
    held_write.await??;

    let checkpoint_progress = checkpoint??.ok_or("a file database has a write-ahead log")?;
    assert!(checkpoint_progress.log_frame_count > 0);
    Ok(())
}

#[tokio::test]
async fn a_checkpoint_copies_a_quiet_log_into_the_database_file()
-> Result<(), Box<dyn std::error::Error>> {
    let database_folder = tempfile::tempdir()?;
    let database = Database::open(
        DatabaseLocation::File(database_folder.path().join("sendmock.db")),
        EMBEDDED_MIGRATIONS,
    )?;
    save_many_settings(&database, 500).await?;

    let checkpoint_progress = database
        .checkpoint_without_blocking_writes()
        .await?
        .ok_or("a file database has a write-ahead log")?;

    assert_eq!(
        checkpoint_progress.checkpointed_frame_count,
        checkpoint_progress.log_frame_count
    );
    Ok(())
}

// AC: PL-08.2
#[tokio::test]
async fn no_write_runs_a_checkpoint_itself() -> Result<(), Box<dyn std::error::Error>> {
    let database_folder = tempfile::tempdir()?;
    let database = Database::open(
        DatabaseLocation::File(database_folder.path().join("sendmock.db")),
        EMBEDDED_MIGRATIONS,
    )?;

    let automatic_checkpoint_pages: i64 = database
        .write(|connection| {
            Ok(connection.query_row("PRAGMA wal_autocheckpoint", [], |row| row.get(0))?)
        })
        .await?;

    assert_eq!(automatic_checkpoint_pages, 0);
    Ok(())
}

#[tokio::test]
async fn an_in_memory_database_has_no_log_to_checkpoint() -> Result<(), StoreError> {
    let database = Database::open(DatabaseLocation::InMemory, EMBEDDED_MIGRATIONS)?;

    assert_eq!(database.checkpoint_without_blocking_writes().await?, None);
    Ok(())
}
