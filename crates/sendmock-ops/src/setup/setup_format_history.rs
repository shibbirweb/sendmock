/// The first SendMock release that wrote each format version, for messages that name the
/// release a file needs. Every new format version adds a row here.
const FIRST_RELEASE_BY_FORMAT_VERSION: [(i64, &str); 2] = [(1, "0.1.0"), (2, "1.3.0")];

pub fn find_first_release(format_version: i64) -> Option<&'static str> {
    FIRST_RELEASE_BY_FORMAT_VERSION
        .iter()
        .find(|(known_format_version, _)| *known_format_version == format_version)
        .map(|(_, first_release)| *first_release)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setup::CURRENT_FORMAT_VERSION;

    #[test]
    fn knows_the_first_release_of_every_format_up_to_the_current_one() {
        for format_version in 1..=CURRENT_FORMAT_VERSION {
            assert!(
                find_first_release(format_version).is_some(),
                "format {format_version} has no first release"
            );
        }
    }
}
