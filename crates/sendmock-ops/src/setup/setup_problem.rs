/// A problem in a setup file and where it is: the line when the format keeps one (every TOML
/// problem, and syntax errors in JSON and YAML), and the key path, such as
/// `webhook.endpoints[0].secret`, when the problem is in a value.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SetupProblem {
    pub line: Option<usize>,
    pub location: Option<String>,
    pub message: String,
}

impl SetupProblem {
    /// How the problem reads in an error message: by line when known, else by key path.
    pub fn describe(&self) -> String {
        match (self.line, &self.location) {
            (Some(line), _) => format!("line {line}: {}", self.message),
            (None, Some(location)) => format!("{location}: {}", self.message),
            (None, None) => self.message.clone(),
        }
    }
}

/// The key path of `key` inside `parent_location`: `parent.key`, or `key` at the top.
pub fn join_location(parent_location: &str, key: &str) -> String {
    if parent_location.is_empty() {
        key.to_owned()
    } else {
        format!("{parent_location}.{key}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn names_the_line_or_else_the_key_path() {
        let mut setup_problem = SetupProblem {
            line: Some(4),
            location: Some("numbers[0].label".to_owned()),
            message: "Enter a label".to_owned(),
        };
        assert_eq!(setup_problem.describe(), "line 4: Enter a label");

        setup_problem.line = None;
        assert_eq!(setup_problem.describe(), "numbers[0].label: Enter a label");
    }
}
