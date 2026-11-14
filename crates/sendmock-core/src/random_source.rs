mod seeded_random_source;
mod system_random_source;

pub use seeded_random_source::SeededRandomSource;
pub use system_random_source::SystemRandomSource;

/// Random numbers for codes, generated values and simulated failures, replaceable in tests.
pub trait RandomSource: Send + Sync {
    fn next_u64(&self) -> u64;
}
