/// Glob matching where `*` stands for any run of characters and everything else matches
/// itself. Case counts; callers lowercase both sides when it should not.
pub fn matches_wildcard_pattern(pattern: &str, value: &str) -> bool {
    let mut literal_parts = pattern.split('*');
    let first_part = literal_parts.next().unwrap_or_default();
    let Some(mut remaining_value) = value.strip_prefix(first_part) else {
        return false;
    };
    let middle_and_last_parts: Vec<&str> = literal_parts.collect();
    let Some((last_part, middle_parts)) = middle_and_last_parts.split_last() else {
        return remaining_value.is_empty();
    };
    for middle_part in middle_parts {
        match remaining_value.find(middle_part) {
            Some(found_at) => remaining_value = &remaining_value[found_at + middle_part.len()..],
            None => return false,
        }
    }
    remaining_value.ends_with(last_part)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_pattern_without_stars_matches_only_itself() {
        assert!(matches_wildcard_pattern("qa@app.test", "qa@app.test"));
        assert!(!matches_wildcard_pattern("qa@app.test", "qa@app.test.org"));
        assert!(!matches_wildcard_pattern("qa@app.test", "QA@app.test"));
    }

    #[test]
    fn stars_match_any_run_of_characters_including_none() {
        assert!(matches_wildcard_pattern(
            "*@bounce.qa.test",
            "sam@bounce.qa.test"
        ));
        assert!(matches_wildcard_pattern("qa+*@*", "qa+@shop.test"));
        assert!(matches_wildcard_pattern("*", ""));
        assert!(matches_wildcard_pattern("a*b*c", "a-x-b-y-c"));
        assert!(!matches_wildcard_pattern("a*b*c", "a-x-c-y-b"));
    }
}
