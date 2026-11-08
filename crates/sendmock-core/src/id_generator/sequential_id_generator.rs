use std::sync::atomic::{AtomicU64, Ordering};

use super::{IdGenerator, Ulid};

/// Deterministic ids for tests: the same timestamp part and a counter that starts at 1.
#[derive(Debug)]
pub struct SequentialIdGenerator {
    timestamp_unix_ms: u64,
    last_sequence_number: AtomicU64,
}

impl SequentialIdGenerator {
    pub fn new(timestamp_unix_ms: u64) -> Self {
        Self {
            timestamp_unix_ms,
            last_sequence_number: AtomicU64::new(0),
        }
    }
}

impl IdGenerator for SequentialIdGenerator {
    fn generate_id(&self) -> Ulid {
        let sequence_number = self.last_sequence_number.fetch_add(1, Ordering::Relaxed) + 1;
        Ulid::from_parts(self.timestamp_unix_ms, u128::from(sequence_number))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_ids_in_order_from_one() {
        let id_generator = SequentialIdGenerator::new(1_767_225_600_000);

        let first_id = id_generator.generate_id();
        let second_id = id_generator.generate_id();

        assert_eq!(first_id.random(), 1);
        assert_eq!(second_id.random(), 2);
        assert!(first_id < second_id);
        assert_eq!(first_id.timestamp_ms(), 1_767_225_600_000);
    }

    #[test]
    fn two_generators_with_the_same_start_agree() {
        let first_generator = SequentialIdGenerator::new(1_767_225_600_000);
        let second_generator = SequentialIdGenerator::new(1_767_225_600_000);

        assert_eq!(
            first_generator.generate_id(),
            second_generator.generate_id()
        );
    }
}
