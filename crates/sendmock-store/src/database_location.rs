use std::fmt;
use std::path::PathBuf;

const IN_MEMORY_KEYWORD: &str = "memory";

/// Where the SQLite database lives: a file, or memory for runs that keep nothing.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DatabaseLocation {
    File(PathBuf),
    InMemory,
}

impl DatabaseLocation {
    /// Reads a `--db` value: `memory` (or SQLite's own `:memory:`) or a file path.
    pub fn from_setting(setting: &str) -> Self {
        if setting == IN_MEMORY_KEYWORD || setting == ":memory:" {
            Self::InMemory
        } else {
            Self::File(PathBuf::from(setting))
        }
    }
}

impl fmt::Display for DatabaseLocation {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::File(file_path) => write!(formatter, "{}", file_path.display()),
            Self::InMemory => formatter.write_str(IN_MEMORY_KEYWORD),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_memory_as_in_memory() {
        assert_eq!(
            DatabaseLocation::from_setting("memory"),
            DatabaseLocation::InMemory
        );
        assert_eq!(
            DatabaseLocation::from_setting(":memory:"),
            DatabaseLocation::InMemory
        );
    }

    #[test]
    fn reads_anything_else_as_a_file_path() {
        assert_eq!(
            DatabaseLocation::from_setting("./data/sendmock.db"),
            DatabaseLocation::File(PathBuf::from("./data/sendmock.db"))
        );
    }

    #[test]
    fn displays_the_setting_it_was_read_from() {
        assert_eq!(DatabaseLocation::InMemory.to_string(), "memory");
        assert_eq!(
            DatabaseLocation::File(PathBuf::from("sendmock.db")).to_string(),
            "sendmock.db"
        );
    }
}
