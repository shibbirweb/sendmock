/// Bytes in a size such as `25MB`, `512KB`, `1GB` or `1000` (bytes). Units are binary
/// (1 MB is 1,048,576 bytes), as mail servers count message sizes; case is ignored.
pub fn parse_size_bytes(size_text: &str) -> Option<u64> {
    let normalized_text = size_text.trim().to_ascii_uppercase();
    let units: [(&str, u64); 4] = [("GB", 1 << 30), ("MB", 1 << 20), ("KB", 1 << 10), ("B", 1)];
    let (number_text, unit_bytes) = units
        .iter()
        .find_map(|(unit_suffix, unit_bytes)| {
            normalized_text
                .strip_suffix(unit_suffix)
                .map(|number_text| (number_text, *unit_bytes))
        })
        .unwrap_or((normalized_text.as_str(), 1));
    number_text
        .trim()
        .parse::<u64>()
        .ok()?
        .checked_mul(unit_bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_sizes_with_binary_units() {
        assert_eq!(parse_size_bytes("25MB"), Some(25 * 1024 * 1024));
        assert_eq!(parse_size_bytes("512kb"), Some(512 * 1024));
        assert_eq!(parse_size_bytes("1 GB"), Some(1 << 30));
        assert_eq!(parse_size_bytes("100B"), Some(100));
        assert_eq!(parse_size_bytes("2048"), Some(2048));
    }

    #[test]
    fn refuses_text_that_is_not_a_size() {
        assert_eq!(parse_size_bytes("large"), None);
        assert_eq!(parse_size_bytes("-5MB"), None);
        assert_eq!(parse_size_bytes(""), None);
    }
}
