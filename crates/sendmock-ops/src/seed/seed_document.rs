use super::seed_sections::{SEED_SECTIONS, SeedSection, format_section_header};

/// The items of one section of a parsed seed file: each `[[path]]` table, or the one
/// `[settings]` table; none when the file leaves the section out.
pub fn read_section_items(
    seed_document: &toml::Table,
    seed_section: &SeedSection,
) -> Vec<toml::Table> {
    let mut section_value: Option<&toml::Value> = None;
    let mut current_table = seed_document;
    for path_part in seed_section.section_path.split('.') {
        section_value = current_table.get(path_part);
        match section_value {
            Some(toml::Value::Table(nested_table)) => current_table = nested_table,
            _ => break,
        }
    }
    match section_value {
        Some(toml::Value::Array(items)) if seed_section.is_item_list => items
            .iter()
            .filter_map(|item| item.as_table().cloned())
            .collect(),
        Some(toml::Value::Table(section_table)) if !seed_section.is_item_list => {
            vec![section_table.clone()]
        }
        _ => Vec::new(),
    }
}

/// The headers of sections the file holds that this build cannot apply yet.
pub fn list_unsupported_sections(
    seed_document: &toml::Table,
    supported_sections: &[&'static SeedSection],
) -> Vec<String> {
    SEED_SECTIONS
        .iter()
        .filter(|seed_section| {
            !supported_sections
                .iter()
                .any(|supported| supported.section_path == seed_section.section_path)
        })
        .filter(|seed_section| !read_section_items(seed_document, seed_section).is_empty())
        .map(|seed_section| {
            format_section_header(seed_section.section_path, seed_section.is_item_list)
        })
        .collect()
}

/// A seed file holding only this section's items, written as TOML.
pub fn write_section_toml(
    seed_section: &SeedSection,
    items: Vec<toml::Table>,
) -> Result<String, toml::ser::Error> {
    let section_value = if seed_section.is_item_list {
        toml::Value::Array(items.into_iter().map(toml::Value::Table).collect())
    } else {
        toml::Value::Table(items.into_iter().next().unwrap_or_default())
    };
    let mut path_parts: Vec<&str> = seed_section.section_path.split('.').collect();
    let mut nested_value = section_value;
    while let Some(path_part) = path_parts.pop() {
        let mut wrapper_table = toml::Table::new();
        wrapper_table.insert(path_part.to_owned(), nested_value);
        nested_value = toml::Value::Table(wrapper_table);
    }
    let toml::Value::Table(document_table) = nested_value else {
        return Ok(String::new());
    };
    toml::to_string(&document_table)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::seed::seed_sections::{NUMBERS_SECTION, SETTINGS_SECTION, VERIFY_SERVICES_SECTION};

    fn parse(seed_toml: &str) -> toml::Table {
        toml::from_str(seed_toml).unwrap_or_else(|error| panic!("a seed: {error}"))
    }

    #[test]
    fn reads_item_lists_nested_lists_and_the_settings_table() {
        let seed_document = parse(
            "[settings]\nsms_failure_rate_percent = 5\n\n[[numbers]]\nnumber = \"+15550001111\"\n\n[[verify.services]]\nname = \"Login\"\n",
        );

        assert_eq!(
            read_section_items(&seed_document, &SETTINGS_SECTION).len(),
            1
        );
        assert_eq!(
            read_section_items(&seed_document, &NUMBERS_SECTION).len(),
            1
        );
        let verify_services = read_section_items(&seed_document, &VERIFY_SERVICES_SECTION);
        assert_eq!(verify_services[0]["name"].as_str(), Some("Login"));
    }

    #[test]
    fn lists_sections_this_build_cannot_apply() {
        let seed_document =
            parse("[[http.bins]]\nname = \"stripe\"\n\n[[numbers]]\nnumber = \"+1\"\n");

        assert_eq!(
            list_unsupported_sections(&seed_document, &[&NUMBERS_SECTION]),
            ["[[http.bins]]"]
        );
    }

    #[test]
    fn writes_a_nested_section_as_an_array_of_tables() {
        let mut service_table = toml::Table::new();
        service_table.insert("name".to_owned(), toml::Value::from("Login"));

        let section_toml = write_section_toml(&VERIFY_SERVICES_SECTION, vec![service_table])
            .unwrap_or_else(|error| panic!("a section: {error}"));

        assert_eq!(section_toml, "[[verify.services]]\nname = \"Login\"\n");
    }
}
