use std::sync::mpsc;
use std::thread;

use rusqlite::Connection;
use tokio::sync::oneshot;

use crate::StoreError;

type WriteJob = Box<dyn FnOnce(&mut Connection) + Send>;

/// Owns the only write connection on its own thread and applies writes in the order sent,
/// so writers never wait on SQLite's lock.
pub struct DatabaseWriter {
    write_jobs: mpsc::Sender<WriteJob>,
}

impl DatabaseWriter {
    pub fn start(mut connection: Connection) -> Self {
        let (write_jobs, received_write_jobs) = mpsc::channel::<WriteJob>();
        thread::spawn(move || {
            for write_job in received_write_jobs {
                write_job(&mut connection);
            }
            // The last sender is gone, so the store is closing.
            let _ = connection.execute_batch("PRAGMA optimize;");
        });
        Self { write_jobs }
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
        self.write_jobs
            .send(write_job)
            .map_err(|_| StoreError::WriterStopped)?;
        result_receiver
            .await
            .map_err(|_| StoreError::WriterStopped)?
    }
}
