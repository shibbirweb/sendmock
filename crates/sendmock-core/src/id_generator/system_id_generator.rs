use std::sync::{Mutex, PoisonError};

use ulid::Generator;

use super::{IdGenerator, Ulid};

/// Ids that sort in the order they were made, even within one millisecond, since lists, cursors
/// and "the newest" read them in id order. Shared by the whole process, as the clock is.
static MONOTONIC_GENERATOR: Mutex<Generator> = Mutex::new(Generator::new());

#[derive(Debug, Default, Clone, Copy)]
pub struct SystemIdGenerator;

impl IdGenerator for SystemIdGenerator {
    fn generate_id(&self) -> Ulid {
        let mut monotonic_generator = MONOTONIC_GENERATOR
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        // The random part overflows only after 2^80 ids in one millisecond; a fresh id is fine then.
        monotonic_generator
            .generate()
            .unwrap_or_else(|_| Ulid::generate())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_a_different_id_each_time() {
        let first_id = SystemIdGenerator.generate_id();
        let second_id = SystemIdGenerator.generate_id();

        assert_ne!(first_id, second_id);
    }

    #[test]
    fn ids_made_in_the_same_millisecond_still_sort_in_the_order_they_were_made() {
        let generated_ids: Vec<Ulid> = (0..10_000)
            .map(|_| SystemIdGenerator.generate_id())
            .collect();

        assert!(
            generated_ids
                .windows(2)
                .all(|id_pair| id_pair[0] < id_pair[1])
        );
    }
}
