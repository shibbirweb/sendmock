use super::setup_header::{HEADER_KEY, build_setup_header};
use super::setup_migration::SetupMigration;

/// Format 1, the seed file before versions, to format 2: adds the `[sendmock]` header. Every
/// section keeps its shape, as format 2 only added sections.
pub struct FormatOneToTwoMigration;

impl SetupMigration for FormatOneToTwoMigration {
    fn from_format_version(&self) -> i64 {
        1
    }

    fn upgrade(&self, setup_document: &mut toml::Table) {
        setup_document.insert(
            HEADER_KEY.to_owned(),
            build_setup_header(2, None, None).into(),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setup::SetupHeader;

    // AC: PL-18.3
    #[test]
    fn adds_the_header_and_keeps_every_section() {
        let mut setup_document: toml::Table = "[[numbers]]\nnumber = \"+15550001111\"\n"
            .parse()
            .unwrap_or_else(|error| panic!("a seed: {error}"));
        let numbers_before = setup_document["numbers"].clone();

        FormatOneToTwoMigration.upgrade(&mut setup_document);

        assert_eq!(SetupHeader::read(&setup_document).format_version, 2);
        assert_eq!(setup_document["numbers"], numbers_before);
    }
}
