use sendmock_core::matches_wildcard_pattern;

/// Which recipients the server accepts: every one (`*`, the default), or those matching a
/// glob list such as `*@app.test,qa@*`; the rest get 550 so bounce handling can be tested.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RecipientPolicy {
    allowed_patterns: Vec<String>,
}

impl Default for RecipientPolicy {
    fn default() -> Self {
        Self {
            allowed_patterns: vec!["*".to_owned()],
        }
    }
}

impl RecipientPolicy {
    pub fn from_glob_list(glob_list: &str) -> Self {
        let allowed_patterns: Vec<String> = glob_list
            .split(',')
            .map(|pattern| pattern.trim().to_lowercase())
            .filter(|pattern| !pattern.is_empty())
            .collect();
        if allowed_patterns.is_empty() {
            return Self::default();
        }
        Self { allowed_patterns }
    }

    pub fn is_allowed(&self, recipient_address: &str) -> bool {
        let recipient_address = recipient_address.to_lowercase();
        self.allowed_patterns
            .iter()
            .any(|pattern| matches_wildcard_pattern(pattern, &recipient_address))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_everyone_by_default() {
        assert!(RecipientPolicy::default().is_allowed("anyone@anywhere.test"));
    }

    #[test]
    fn accepts_only_matching_recipients() {
        let recipient_policy = RecipientPolicy::from_glob_list("*@app.test, qa@*");

        assert!(recipient_policy.is_allowed("Sam@App.test"));
        assert!(recipient_policy.is_allowed("qa@other.test"));
        assert!(!recipient_policy.is_allowed("sam@other.test"));
    }
}
