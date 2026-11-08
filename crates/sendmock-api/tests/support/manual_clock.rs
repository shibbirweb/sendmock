use std::sync::atomic::{AtomicI64, Ordering};

use sendmock_core::Clock;

/// A clock the test moves forward by hand, so retry times can be reached without waiting.
pub struct ManualClock {
    now_unix_ms: AtomicI64,
}

impl ManualClock {
    pub fn new(start_unix_ms: i64) -> Self {
        Self {
            now_unix_ms: AtomicI64::new(start_unix_ms),
        }
    }

    pub fn advance_ms(&self, elapsed_ms: i64) {
        self.now_unix_ms.fetch_add(elapsed_ms, Ordering::SeqCst);
    }
}

impl Clock for ManualClock {
    fn now_unix_ms(&self) -> i64 {
        self.now_unix_ms.load(Ordering::SeqCst)
    }
}
