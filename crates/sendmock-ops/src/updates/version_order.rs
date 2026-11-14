use std::cmp::Ordering;

/// A part of a prerelease such as `beta.2`: numbers compare as numbers, words as text.
#[derive(Debug, Clone, PartialEq, Eq)]
enum PrereleasePart {
    Number(u64),
    Word(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct ParsedVersion {
    core_numbers: [u64; 3],
    /// Empty for a stable version.
    prerelease_parts: Vec<PrereleasePart>,
}

fn parse_version(version: &str) -> Option<ParsedVersion> {
    let version = version.trim().trim_start_matches('v');
    let (core_text, prerelease_text) = version.split_once('-').unwrap_or((version, ""));
    let mut core_parts = core_text
        .split('.')
        .map(|core_part| core_part.parse::<u64>().ok());
    let core_numbers = [
        core_parts.next()??,
        core_parts.next()??,
        core_parts.next()??,
    ];
    if core_parts.next().is_some() {
        return None;
    }
    let prerelease_parts = prerelease_text
        .split('.')
        .filter(|prerelease_part| !prerelease_part.is_empty())
        .map(|prerelease_part| match prerelease_part.parse() {
            Ok(number) => PrereleasePart::Number(number),
            Err(_) => PrereleasePart::Word(prerelease_part.to_owned()),
        })
        .collect();
    Some(ParsedVersion {
        core_numbers,
        prerelease_parts,
    })
}

fn compare_prerelease_parts(
    left_parts: &[PrereleasePart],
    right_parts: &[PrereleasePart],
) -> Ordering {
    // A stable version is newer than any prerelease of the same core version.
    match (left_parts.is_empty(), right_parts.is_empty()) {
        (true, true) => return Ordering::Equal,
        (true, false) => return Ordering::Greater,
        (false, true) => return Ordering::Less,
        (false, false) => {}
    }
    for (left_part, right_part) in left_parts.iter().zip(right_parts) {
        let part_order = match (left_part, right_part) {
            (PrereleasePart::Number(left_number), PrereleasePart::Number(right_number)) => {
                left_number.cmp(right_number)
            }
            (PrereleasePart::Number(_), PrereleasePart::Word(_)) => Ordering::Less,
            (PrereleasePart::Word(_), PrereleasePart::Number(_)) => Ordering::Greater,
            (PrereleasePart::Word(left_word), PrereleasePart::Word(right_word)) => {
                left_word.cmp(right_word)
            }
        };
        if part_order != Ordering::Equal {
            return part_order;
        }
    }
    left_parts.len().cmp(&right_parts.len())
}

/// Semantic version order; versions that do not parse compare equal.
pub fn compare_versions(left_version: &str, right_version: &str) -> Ordering {
    let (Some(left_parsed), Some(right_parsed)) =
        (parse_version(left_version), parse_version(right_version))
    else {
        return Ordering::Equal;
    };
    left_parsed
        .core_numbers
        .cmp(&right_parsed.core_numbers)
        .then_with(|| {
            compare_prerelease_parts(
                &left_parsed.prerelease_parts,
                &right_parsed.prerelease_parts,
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn orders_versions_as_semver_does() {
        assert_eq!(compare_versions("0.2.0", "0.1.9"), Ordering::Greater);
        assert_eq!(compare_versions("0.2.0", "0.2.0-beta.3"), Ordering::Greater);
        assert_eq!(
            compare_versions("0.2.0-beta.10", "0.2.0-beta.2"),
            Ordering::Greater
        );
        assert_eq!(compare_versions("v1.0.0", "1.0.0"), Ordering::Equal);
        assert_eq!(
            compare_versions("1.0.0-alpha", "1.0.0-beta"),
            Ordering::Less
        );
        assert_eq!(compare_versions("not a version", "1.0.0"), Ordering::Equal);
    }
}
