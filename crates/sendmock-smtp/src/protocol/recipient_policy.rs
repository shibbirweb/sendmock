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
            .any(|pattern| matches_glob(pattern, &recipient_address))
    }
}

/// `*` matches any run of characters, everything else matches itself.
fn matches_glob(pattern: &str, text: &str) -> bool {
    let mut literal_parts = pattern.split('*');
    let first_part = literal_parts.next().unwrap_or_default();
    let Some(mut remaining_text) = text.strip_prefix(first_part) else {
        return false;
    };
    let middle_and_last: Vec<&str> = literal_parts.collect();
    let Some((last_part, middle_parts)) = middle_and_last.split_last() else {
        return remaining_text.is_empty();
    };
    for middle_part in middle_parts {
        match remaining_text.find(middle_part) {
            Some(found_position) => {
                remaining_text = &remaining_text[found_position + middle_part.len()..]
            }
            None => return false,
        }
    }
    remaining_text.ends_with(last_part)
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
