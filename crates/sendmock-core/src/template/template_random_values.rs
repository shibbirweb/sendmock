//! Random and generated values for template functions, drawn from a `RandomSource` so tests
//! can fix them.

use ulid::Ulid;

use crate::RandomSource;

/// The characters `random_string` picks from, by charset name; unknown names use `alnum`.
pub fn read_charset(charset_name: &str) -> &'static [u8] {
    match charset_name {
        "alpha" => b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
        "numeric" => b"0123456789",
        "hex" => b"0123456789abcdef",
        "upper" => b"ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        "lower" => b"abcdefghijklmnopqrstuvwxyz",
        _ => b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    }
}

pub fn generate_random_text(
    random_source: &dyn RandomSource,
    length: usize,
    charset: &[u8],
) -> String {
    (0..length)
        .map(|_| {
            let character_index = random_index(random_source, charset.len());
            char::from(charset[character_index])
        })
        .collect()
}

/// An index below `item_count` (which must be above zero).
pub fn random_index(random_source: &dyn RandomSource, item_count: usize) -> usize {
    let item_count_u64 = u64::try_from(item_count).unwrap_or(u64::MAX).max(1);
    usize::try_from(random_source.next_u64() % item_count_u64).unwrap_or(0)
}

pub fn generate_random_hex(random_source: &dyn RandomSource, length: usize) -> String {
    let mut hex_text = String::with_capacity(length + 16);
    while hex_text.len() < length {
        hex_text.push_str(&format!("{:016x}", random_source.next_u64()));
    }
    hex_text.truncate(length);
    hex_text
}

/// A version 4 UUID.
pub fn generate_uuid_v4(random_source: &dyn RandomSource) -> String {
    let hex_text = generate_random_hex(random_source, 32);
    format!(
        "{}-{}-4{}-{}{}-{}",
        &hex_text[0..8],
        &hex_text[8..12],
        &hex_text[13..16],
        ["8", "9", "a", "b"][usize::from(hex_text.as_bytes()[16] % 4)],
        &hex_text[17..20],
        &hex_text[20..32]
    )
}

/// A version 7 UUID: the Unix time in milliseconds first, so they sort by creation time.
pub fn generate_uuid_v7(random_source: &dyn RandomSource, now_unix_ms: i64) -> String {
    let time_hex = format!("{:012x}", now_unix_ms.max(0) & 0xffff_ffff_ffff);
    let random_hex = generate_random_hex(random_source, 20);
    format!(
        "{}-{}-7{}-{}{}-{}",
        &time_hex[0..8],
        &time_hex[8..12],
        &random_hex[0..3],
        ["8", "9", "a", "b"][usize::from(random_hex.as_bytes()[3] % 4)],
        &random_hex[4..7],
        &random_hex[8..20]
    )
}

pub fn generate_ulid(random_source: &dyn RandomSource, now_unix_ms: i64) -> String {
    let random_bits =
        (u128::from(random_source.next_u64()) << 64) | u128::from(random_source.next_u64());
    let timestamp_ms = u64::try_from(now_unix_ms).unwrap_or(0);
    Ulid::from_parts(timestamp_ms, random_bits).to_string()
}

/// An integer from `smallest` to `largest`, both included; the bounds may come in any order.
pub fn generate_random_int(random_source: &dyn RandomSource, smallest: i64, largest: i64) -> i64 {
    let (low, high) = (smallest.min(largest), smallest.max(largest));
    let span = u64::try_from(i128::from(high) - i128::from(low) + 1).unwrap_or(u64::MAX);
    let offset = random_source.next_u64() % span.max(1);
    i64::try_from(i128::from(low) + i128::from(offset)).unwrap_or(low)
}

/// A float from `smallest` to `largest`, rounded to `decimals` places.
pub fn generate_random_float(
    random_source: &dyn RandomSource,
    smallest: f64,
    largest: f64,
    decimals: u32,
) -> f64 {
    let fraction = (random_source.next_u64() >> 11) as f64 / (1_u64 << 53) as f64;
    let random_value = smallest + (largest - smallest) * fraction;
    let scale = 10_f64.powi(i32::try_from(decimals.min(10)).unwrap_or(2));
    (random_value * scale).round() / scale
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::SeededRandomSource;

    #[test]
    fn uuids_carry_their_version() {
        let random_source = SeededRandomSource::new(1);

        let uuid_v4 = generate_uuid_v4(&random_source);
        let uuid_v7 = generate_uuid_v7(&random_source, 1_767_225_600_000);

        assert_eq!(uuid_v4.chars().nth(14), Some('4'));
        assert_eq!(uuid_v7.chars().nth(14), Some('7'));
        assert!(uuid_v7.starts_with("019b76da-a800-7"));
        assert_eq!(uuid_v7.len(), 36);
    }

    #[test]
    fn ulids_start_with_the_time() {
        let ulid_text = generate_ulid(&SeededRandomSource::new(1), 1_767_225_600_000);

        assert_eq!(ulid_text.len(), 26);
        assert_eq!(
            Ulid::from_string(&ulid_text).map(|ulid| ulid.timestamp_ms()),
            Ok(1_767_225_600_000)
        );
    }

    #[test]
    fn numbers_stay_in_range() {
        let random_source = SeededRandomSource::new(9);

        for _ in 0..50 {
            let random_int = generate_random_int(&random_source, 10, 1);
            let random_float = generate_random_float(&random_source, 1.0, 2.0, 2);
            assert!((1..=10).contains(&random_int));
            assert!((1.0..=2.0).contains(&random_float));
            assert_eq!((random_float * 100.0).round() / 100.0, random_float);
        }
    }

    #[test]
    fn text_uses_the_charset() {
        let random_text =
            generate_random_text(&SeededRandomSource::new(2), 20, read_charset("numeric"));

        assert_eq!(random_text.len(), 20);
        assert!(
            random_text
                .chars()
                .all(|character| character.is_ascii_digit())
        );
    }
}
