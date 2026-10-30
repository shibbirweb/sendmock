use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use sendmock_store::{
    Database, DatabaseLocation, EMBEDDED_MIGRATIONS, SmtpSessionFilter, SmtpSessionRecord,
    SmtpSessionRepository, StoreError,
};

const WRITE_COUNT: usize = 300;

fn session(session_number: usize) -> SmtpSessionRecord {
    SmtpSessionRecord {
        session_id: format!("01J{session_number:023}"),
        started_at_unix_ms: 1,
        ended_at_unix_ms: 2,
        remote_address: "127.0.0.1:1".to_owned(),
        helo_name: "app.test".to_owned(),
        tls_version: None,
        auth_mechanism: None,
        auth_user: None,
        result: "aborted".to_owned(),
        failure_reason: None,
        email_ids: Vec::new(),
        transcript: String::new(),
    }
}

/// Readers polling while the writer writes, as the UI and `wait` helpers do, never make a
/// write fail in the in-memory store.
#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn writes_succeed_while_readers_poll_the_in_memory_store() -> Result<(), StoreError> {
    let database = Arc::new(Database::open(
        DatabaseLocation::InMemory,
        EMBEDDED_MIGRATIONS,
    )?);
    let repository = SmtpSessionRepository::new(Arc::clone(&database));
    let is_writing = Arc::new(AtomicBool::new(true));
    let mut readers = Vec::new();
    for _ in 0..4 {
        let reader_repository = repository.clone();
        let is_writing = Arc::clone(&is_writing);
        readers.push(tokio::spawn(async move {
            while is_writing.load(Ordering::Relaxed) {
                let _ = reader_repository
                    .list_sessions(SmtpSessionFilter::default(), None, 50)
                    .await;
            }
        }));
    }

    let mut write_results = Vec::new();
    for session_number in 0..WRITE_COUNT {
        write_results.push(repository.insert_session(session(session_number)).await);
    }
    is_writing.store(false, Ordering::Relaxed);
    for reader in readers {
        let _ = reader.await;
    }

    let failed_writes: Vec<&StoreError> = write_results
        .iter()
        .filter_map(|write_result| write_result.as_ref().err())
        .collect();
    assert!(
        failed_writes.is_empty(),
        "{} writes failed, first: {}",
        failed_writes.len(),
        failed_writes[0]
    );
    let stored_page = repository
        .list_sessions(SmtpSessionFilter::default(), None, 1)
        .await?;
    assert_eq!(stored_page.total_count, WRITE_COUNT as u64);
    Ok(())
}
