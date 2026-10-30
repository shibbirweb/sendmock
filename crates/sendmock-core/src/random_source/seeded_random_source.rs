use std::sync::atomic::{AtomicU64, Ordering};

use super::RandomSource;

/// The SplitMix64 increment; any odd constant works, this one spreads bits well.
const GOLDEN_RATIO_INCREMENT: u64 = 0x9E37_79B9_7F4A_7C15;

/// A repeatable sequence for tests: the same seed always gives the same numbers.
#[derive(Debug)]
pub struct SeededRandomSource {
    state: AtomicU64,
}

impl SeededRandomSource {
    pub fn new(seed: u64) -> Self {
        Self {
            state: AtomicU64::new(seed),
        }
    }
}

impl RandomSource for SeededRandomSource {
    fn next_u64(&self) -> u64 {
        let previous_state = self
            .state
            .fetch_add(GOLDEN_RATIO_INCREMENT, Ordering::Relaxed);
        mix_bits(previous_state.wrapping_add(GOLDEN_RATIO_INCREMENT))
    }
}

/// The SplitMix64 finaliser.
fn mix_bits(state: u64) -> u64 {
    let mut mixed = state;
    mixed = (mixed ^ (mixed >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
    mixed = (mixed ^ (mixed >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
    mixed ^ (mixed >> 31)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_same_seed_gives_the_same_sequence() {
        let first_source = SeededRandomSource::new(42);
        let second_source = SeededRandomSource::new(42);

        let first_sequence: Vec<u64> = (0..4).map(|_| first_source.next_u64()).collect();
        let second_sequence: Vec<u64> = (0..4).map(|_| second_source.next_u64()).collect();

        assert_eq!(first_sequence, second_sequence);
    }

    #[test]
    fn different_seeds_give_different_numbers() {
        assert_ne!(
            SeededRandomSource::new(1).next_u64(),
            SeededRandomSource::new(2).next_u64()
        );
    }

    #[test]
    fn matches_the_published_splitmix64_sequence_for_seed_zero() {
        let source = SeededRandomSource::new(0);

        assert_eq!(source.next_u64(), 0xE220_A839_7B1D_CDAF);
    }
}
