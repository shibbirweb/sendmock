//! Shared types every SendMock crate builds on: events, value objects, errors and the clock and id traits.

pub mod clock;
pub mod id_generator;
pub mod random_source;

pub use clock::{Clock, FixedClock, SystemClock};
pub use id_generator::{IdGenerator, SequentialIdGenerator, SystemIdGenerator};
pub use random_source::{RandomSource, SeededRandomSource, SystemRandomSource};
