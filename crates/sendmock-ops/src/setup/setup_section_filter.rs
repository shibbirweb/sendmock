use crate::OperationError;
use crate::seed::{SEED_SECTIONS, SeedSection};

/// Which sections an export writes: `only` keeps the named ones, `except` leaves the named
/// ones out. A name is a section (`webhook.endpoints`) or a group of them (`webhook`).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct SetupSectionFilter {
    only_names: Vec<String>,
    except_names: Vec<String>,
}

impl SetupSectionFilter {
    /// Refuses a name that is neither a section nor a group, listing the ones there are.
    pub fn read(only_names: &[String], except_names: &[String]) -> Result<Self, OperationError> {
        let read_names = |section_names: &[String], field_name: &str| {
            section_names
                .iter()
                .map(|section_name| section_name.trim().to_owned())
                .filter(|section_name| !section_name.is_empty())
                .map(|section_name| {
                    if SEED_SECTIONS
                        .iter()
                        .any(|seed_section| is_named(seed_section, &section_name))
                    {
                        Ok(section_name)
                    } else {
                        Err(OperationError::InvalidInput {
                            message: format!(
                                "{section_name} is not a setup section; the sections are {}",
                                list_section_names()
                            ),
                            field: Some(field_name.to_owned()),
                        })
                    }
                })
                .collect::<Result<Vec<_>, _>>()
        };
        Ok(Self {
            only_names: read_names(only_names, "only")?,
            except_names: read_names(except_names, "except")?,
        })
    }

    pub fn includes(&self, seed_section: &SeedSection) -> bool {
        let is_kept = self.only_names.is_empty()
            || self
                .only_names
                .iter()
                .any(|section_name| is_named(seed_section, section_name));
        let is_left_out = self
            .except_names
            .iter()
            .any(|section_name| is_named(seed_section, section_name));
        is_kept && !is_left_out
    }
}

fn is_named(seed_section: &SeedSection, section_name: &str) -> bool {
    seed_section.section_path == section_name
        || seed_section
            .section_path
            .strip_prefix(section_name)
            .is_some_and(|rest| rest.starts_with('.'))
}

fn list_section_names() -> String {
    SEED_SECTIONS
        .iter()
        .map(|seed_section| seed_section.section_path)
        .collect::<Vec<_>>()
        .join(", ")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::seed::{NUMBERS_SECTION, SETTINGS_SECTION, WEBHOOK_ENDPOINTS_SECTION};

    fn names(section_names: &[&str]) -> Vec<String> {
        section_names
            .iter()
            .map(|name| (*name).to_owned())
            .collect()
    }

    #[test]
    fn keeps_every_section_by_default() {
        let section_filter = SetupSectionFilter::default();

        assert!(section_filter.includes(&SETTINGS_SECTION));
        assert!(section_filter.includes(&NUMBERS_SECTION));
    }

    #[test]
    fn keeps_named_sections_and_groups_and_leaves_out_the_excepted() {
        let section_filter = SetupSectionFilter::read(&names(&["webhook", "numbers"]), &[])
            .unwrap_or_else(|error| panic!("a filter: {error}"));
        let except_filter = SetupSectionFilter::read(&[], &names(&["settings"]))
            .unwrap_or_else(|error| panic!("a filter: {error}"));

        assert!(section_filter.includes(&WEBHOOK_ENDPOINTS_SECTION));
        assert!(section_filter.includes(&NUMBERS_SECTION));
        assert!(!section_filter.includes(&SETTINGS_SECTION));
        assert!(!except_filter.includes(&SETTINGS_SECTION));
        assert!(except_filter.includes(&NUMBERS_SECTION));
    }

    #[test]
    fn refuses_an_unknown_section_name() {
        let filter_result = SetupSectionFilter::read(&names(&["webhooks"]), &[]);

        assert!(matches!(
            filter_result,
            Err(OperationError::InvalidInput { field: Some(field), .. }) if field == "only"
        ));
    }
}
