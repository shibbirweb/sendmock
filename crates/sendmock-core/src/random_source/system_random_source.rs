use super::RandomSource;

#[derive(Debug, Default, Clone, Copy)]
pub struct SystemRandomSource;

impl RandomSource for SystemRandomSource {
    fn next_u64(&self) -> u64 {
        rand::random()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn returns_different_numbers() {
        let numbers: Vec<u64> = (0..8).map(|_| SystemRandomSource.next_u64()).collect();

        assert!(numbers.iter().any(|number| *number != numbers[0]));
    }
}
