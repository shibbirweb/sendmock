use std::collections::BTreeMap;

/// Reads environment variables for `${ENV_VAR}` references in seed files.
pub trait EnvironmentReader: Send + Sync {
    fn read_variable(&self, variable_name: &str) -> Option<String>;

    /// Every variable whose name starts with `name_prefix`, with its full name, by name.
    fn read_prefixed_variables(&self, name_prefix: &str) -> Vec<(String, String)>;
}

/// The process environment, as the binary runs.
pub struct ProcessEnvironment;

impl EnvironmentReader for ProcessEnvironment {
    fn read_variable(&self, variable_name: &str) -> Option<String> {
        std::env::var(variable_name).ok()
    }

    fn read_prefixed_variables(&self, name_prefix: &str) -> Vec<(String, String)> {
        let mut prefixed_variables: Vec<(String, String)> = std::env::vars()
            .filter(|(variable_name, _)| variable_name.starts_with(name_prefix))
            .collect();
        prefixed_variables.sort();
        prefixed_variables
    }
}

/// Fixed values, for tests.
#[derive(Debug, Clone, Default)]
pub struct FixedEnvironment {
    variables: BTreeMap<String, String>,
}

impl FixedEnvironment {
    #[must_use]
    pub fn with_variable(mut self, variable_name: &str, variable_value: &str) -> Self {
        self.variables
            .insert(variable_name.to_owned(), variable_value.to_owned());
        self
    }
}

impl EnvironmentReader for FixedEnvironment {
    fn read_variable(&self, variable_name: &str) -> Option<String> {
        self.variables.get(variable_name).cloned()
    }

    fn read_prefixed_variables(&self, name_prefix: &str) -> Vec<(String, String)> {
        self.variables
            .iter()
            .filter(|(variable_name, _)| variable_name.starts_with(name_prefix))
            .map(|(variable_name, variable_value)| (variable_name.clone(), variable_value.clone()))
            .collect()
    }
}
