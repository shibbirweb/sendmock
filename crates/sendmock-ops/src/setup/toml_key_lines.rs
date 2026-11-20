use std::collections::HashMap;

use toml::Spanned;
use toml::de::{DeTable, DeValue};

use super::setup_problem::{SetupProblem, join_location};
use crate::seed::SeedLineIndex;

/// Where each key and list item of a TOML setup file starts, by key path
/// (`webhook.endpoints[0].secret`), so a problem found in the parsed table names its line.
pub struct TomlKeyLines {
    line_index: SeedLineIndex,
    offsets_by_location: HashMap<String, usize>,
}

impl TomlKeyLines {
    /// Indexes the file, or lists its syntax errors with their lines.
    pub fn read(setup_toml: &str) -> Result<Self, Vec<SetupProblem>> {
        let line_index = SeedLineIndex::new(setup_toml);
        let (setup_document, syntax_errors) = DeTable::parse_recoverable(setup_toml);
        if !syntax_errors.is_empty() {
            return Err(syntax_errors
                .iter()
                .map(|syntax_error| SetupProblem {
                    line: Some(
                        line_index.line_of(syntax_error.span().map_or(0, |span| span.start)),
                    ),
                    location: None,
                    message: syntax_error.message().to_owned(),
                })
                .collect());
        }
        let mut offsets_by_location = HashMap::new();
        record_table(setup_document.get_ref(), "", &mut offsets_by_location);
        Ok(Self {
            line_index,
            offsets_by_location,
        })
    }

    /// The line of the key path, or of the nearest key above it.
    pub fn line_of(&self, location: &str) -> Option<usize> {
        let mut current_location = location;
        loop {
            if let Some(byte_offset) = self.offsets_by_location.get(current_location) {
                return Some(self.line_index.line_of(*byte_offset));
            }
            let parent_end = current_location.rfind(['.', '['])?;
            current_location = &current_location[..parent_end];
        }
    }
}

fn record_table(
    table: &DeTable<'_>,
    location: &str,
    offsets_by_location: &mut HashMap<String, usize>,
) {
    for (key, value) in table {
        let key_location = join_location(location, key.get_ref().as_ref());
        offsets_by_location
            .entry(key_location.clone())
            .or_insert(key.span().start);
        record_value(value, &key_location, offsets_by_location);
    }
}

fn record_value(
    value: &Spanned<DeValue<'_>>,
    location: &str,
    offsets_by_location: &mut HashMap<String, usize>,
) {
    match value.get_ref() {
        DeValue::Table(table) => record_table(table, location, offsets_by_location),
        DeValue::Array(items) => {
            for (item_index, item) in items.iter().enumerate() {
                let item_location = format!("{location}[{item_index}]");
                offsets_by_location
                    .entry(item_location.clone())
                    .or_insert(item.span().start);
                record_value(item, &item_location, offsets_by_location);
            }
        }
        DeValue::String(_)
        | DeValue::Integer(_)
        | DeValue::Float(_)
        | DeValue::Boolean(_)
        | DeValue::Datetime(_) => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn read(setup_toml: &str) -> TomlKeyLines {
        TomlKeyLines::read(setup_toml).unwrap_or_else(|problems| panic!("{problems:?}"))
    }

    #[test]
    fn finds_the_line_of_keys_and_list_items() {
        let key_lines = read(
            "[settings]\nmax_emails = 5\n\n[[email.forward_rules]]\nname = \"A\"\n\n[[email.forward_rules]]\nname = \"B\"\nto = [\n  \"qa@example.com\",\n  \"ops@example.com\",\n]\n",
        );

        assert_eq!(key_lines.line_of("settings.max_emails"), Some(2));
        assert_eq!(key_lines.line_of("email.forward_rules[1].name"), Some(8));
        assert_eq!(key_lines.line_of("email.forward_rules[1].to[1]"), Some(11));
        assert_eq!(key_lines.line_of("settings.unknown"), Some(1));
        assert_eq!(key_lines.line_of("missing"), None);
    }

    #[test]
    fn lists_syntax_errors_with_their_lines() {
        let syntax_problems = TomlKeyLines::read("[settings]\nmax_emails = \n")
            .err()
            .unwrap_or_default();

        assert_eq!(syntax_problems.len(), 1);
        assert_eq!(syntax_problems[0].line, Some(2));
    }
}
