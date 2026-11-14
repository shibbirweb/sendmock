/// The variables a step label can use, as `{name}`, in the order the reference lists them.
pub const FLOW_LABEL_VARIABLE_NAMES: [&str; 7] = [
    "method",
    "amount",
    "currency",
    "merchant",
    "gateway",
    "reference",
    "customer_email",
];

/// `{methd}` and other `{lowercase_name}` tokens a label uses that are not variables.
pub fn find_unknown_variables(step_label: &str) -> Vec<String> {
    let mut unknown_variables = Vec::new();
    let mut remaining_text = step_label;
    while let Some(opening_index) = remaining_text.find('{') {
        let after_opening = &remaining_text[opening_index + 1..];
        let name_length = after_opening
            .find(|character: char| !(character.is_ascii_lowercase() || character == '_'))
            .unwrap_or(after_opening.len());
        let variable_name = &after_opening[..name_length];
        let is_token = name_length > 0 && after_opening[name_length..].starts_with('}');
        if is_token && !FLOW_LABEL_VARIABLE_NAMES.contains(&variable_name) {
            unknown_variables.push(format!("{{{variable_name}}}"));
        }
        remaining_text = after_opening;
    }
    unknown_variables
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_tokens_that_are_not_variables() {
        assert_eq!(
            find_unknown_variables("Pay {amount} with {methd} or {Card} {gateway"),
            ["{methd}"]
        );
        assert!(find_unknown_variables("Your {method} PIN for {customer_email}").is_empty());
    }
}
