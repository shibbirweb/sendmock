use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use rusqlite::Connection;
use tokio::sync::oneshot;

use super::{SLOW_DATABASE_WORK, duration_ms};
use crate::StoreError;

type WriteJob = Box<dyn FnOnce(&mut Connection) + Send>;

struct QueuedWrite {
    write_job: WriteJob,
    queued_at: Instant,
}

/// Owns the only write connection on its own thread and applies writes in the order sent,
/// so writers never wait on SQLite's lock.
pub struct DatabaseWriter {
    queued_writes: mpsc::Sender<QueuedWrite>,
}

impl DatabaseWriter {
    pub fn start(mut connection: Connection) -> Self {
        let (queued_writes, received_writes) = mpsc::channel::<QueuedWrite>();
        thread::spawn(move || {
            for queued_write in received_writes {
                let started_at = Instant::now();
                (queued_write.write_job)(&mut connection);
                warn_when_slow(
                    started_at.duration_since(queued_write.queued_at),
                    started_at.elapsed(),
                );
            }
            // The last sender is gone, so the store is closing.
            let _ = connection.execute_batch("PRAGMA optimize;");
        });
        Self { queued_writes }
    }

    pub async fn write<T, Operation>(&self, operation: Operation) -> Result<T, StoreError>
    where
        T: Send + 'static,
        Operation: FnOnce(&mut Connection) -> Result<T, StoreError> + Send + 'static,
    {
        let (result_sender, result_receiver) = oneshot::channel();
        let write_job: WriteJob = Box::new(move |connection| {
            let _ = result_sender.send(operation(connection));
        });
        self.queued_writes
            .send(QueuedWrite {
                write_job,
                queued_at: Instant::now(),
            })
            .map_err(|_| StoreError::WriterStopped)?;
        result_receiver
            .await
            .map_err(|_| StoreError::WriterStopped)?
    }
}

/// SMTP clients give up after a few seconds, so a slow disk should show up in the log before
/// it shows up as a stalled message.
fn warn_when_slow(queue_wait: Duration, run_duration: Duration) {
    if is_slow_write(queue_wait, run_duration) {
        tracing::warn!(
            queue_wait_ms = duration_ms(queue_wait),
            run_ms = duration_ms(run_duration),
            "a database write was slow"
        );
    }
}

fn is_slow_write(queue_wait: Duration, run_duration: Duration) -> bool {
    queue_wait > SLOW_DATABASE_WORK || run_duration > SLOW_DATABASE_WORK
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_write_that_waits_or_runs_past_a_second_is_slow() {
        let quick = Duration::from_millis(20);
        let slow = Duration::from_millis(1500);

        assert!(!is_slow_write(quick, quick));
        assert!(is_slow_write(slow, quick));
        assert!(is_slow_write(quick, slow));
    }
}
