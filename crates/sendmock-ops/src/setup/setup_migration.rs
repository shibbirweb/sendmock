use super::format_one_to_two_migration::FormatOneToTwoMigration;

/// Upgrades a parsed setup file from one format version to the next (Strategy, kept in the
/// migration registry below). A migration changes only the shape, never the user's file.
pub trait SetupMigration: Send + Sync {
    /// The format version it reads; it writes the next one.
    fn from_format_version(&self) -> i64;

    fn upgrade(&self, setup_document: &mut toml::Table);
}

/// Every migration this build keeps, oldest first. A new format version adds one here, with
/// a fixture file of the older shape in the tests.
pub fn setup_migrations() -> Vec<Box<dyn SetupMigration>> {
    vec![Box::new(FormatOneToTwoMigration)]
}

/// The oldest format version this build can still upgrade.
pub fn find_oldest_upgradable_format_version(current_format_version: i64) -> i64 {
    setup_migrations()
        .iter()
        .map(|setup_migration| setup_migration.from_format_version())
        .min()
        .unwrap_or(current_format_version)
}

/// Runs the migrations from `from_format_version` up to `to_format_version`, one step at a time.
pub fn upgrade_setup_document(
    setup_document: &mut toml::Table,
    from_format_version: i64,
    to_format_version: i64,
) {
    let migrations = setup_migrations();
    for format_version in from_format_version..to_format_version {
        let next_migration = migrations
            .iter()
            .find(|setup_migration| setup_migration.from_format_version() == format_version);
        if let Some(next_migration) = next_migration {
            next_migration.upgrade(setup_document);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::setup::CURRENT_FORMAT_VERSION;

    #[test]
    fn keeps_one_migration_for_each_step_up_to_the_current_format() {
        let oldest_format_version = find_oldest_upgradable_format_version(CURRENT_FORMAT_VERSION);
        let migrations = setup_migrations();

        for format_version in oldest_format_version..CURRENT_FORMAT_VERSION {
            let step_count = migrations
                .iter()
                .filter(|setup_migration| setup_migration.from_format_version() == format_version)
                .count();
            assert_eq!(step_count, 1, "format {format_version} needs one migration");
        }
    }
}
