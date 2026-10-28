/// Turns byte offsets from the TOML parser into the 1-based line numbers people see.
pub struct SeedLineIndex {
    line_start_offsets: Vec<usize>,
}

impl SeedLineIndex {
    pub fn new(seed_toml: &str) -> Self {
        let line_start_offsets = std::iter::once(0)
            .chain(seed_toml.match_indices('\n').map(|(offset, _)| offset + 1))
            .collect();
        Self { line_start_offsets }
    }

    pub fn line_of(&self, byte_offset: usize) -> usize {
        self.line_start_offsets
            .partition_point(|line_start| *line_start <= byte_offset)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbers_lines_from_one() {
        let line_index = SeedLineIndex::new("first\nsecond\nthird");

        assert_eq!(line_index.line_of(0), 1);
        assert_eq!(line_index.line_of(5), 1);
        assert_eq!(line_index.line_of(6), 2);
        assert_eq!(line_index.line_of(13), 3);
    }
}
