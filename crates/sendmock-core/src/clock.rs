mod fixed_clock;
mod system_clock;

pub use fixed_clock::FixedClock;
pub use system_clock::SystemClock;

/// The current time as UTC milliseconds since the Unix epoch, the unit every stored timestamp uses.
pub trait Clock: Send + Sync {
    fn now_unix_ms(&self) -> i64;
}
