use std::collections::BTreeMap;

/// The fields of one email, SMS or open event that a filter is checked against. A field the
/// message does not have is absent, so conditions on it never match.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct RuleMessage {
    field_values: BTreeMap<String, Vec<String>>,
    /// Header values by lowercase name, for `header:<name>` fields; none for messages
    /// without headers, such as an SMS.
    header_values: Option<BTreeMap<String, Vec<String>>>,
}

/// `header:x-tenant` reads the `X-Tenant` header.
pub const HEADER_FIELD_PREFIX: &str = "header:";

impl RuleMessage {
    pub fn with_field(mut self, field_key: &str, values: Vec<String>) -> Self {
        self.field_values.insert(field_key.to_owned(), values);
        self
    }

    pub fn with_headers(mut self, headers: BTreeMap<String, Vec<String>>) -> Self {
        self.header_values = Some(
            headers
                .into_iter()
                .map(|(header_name, values)| (header_name.to_ascii_lowercase(), values))
                .collect(),
        );
        self
    }

    /// Sets one header's values, keeping the others.
    pub fn with_header(mut self, header_name: &str, values: Vec<String>) -> Self {
        self.header_values
            .get_or_insert_with(BTreeMap::new)
            .insert(header_name.to_ascii_lowercase(), values);
        self
    }

    /// The field's values, or none when this message has no such field. A missing header is
    /// an empty list on a message that has headers.
    pub fn read_field(&self, field_key: &str) -> Option<Vec<String>> {
        if let Some(header_name) = field_key.strip_prefix(HEADER_FIELD_PREFIX) {
            return self.header_values.as_ref().map(|header_values| {
                header_values
                    .get(&header_name.to_ascii_lowercase())
                    .cloned()
                    .unwrap_or_default()
            });
        }
        self.field_values.get(field_key).cloned()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn one_header_can_be_set_without_losing_the_others() {
        let rule_message = RuleMessage::default()
            .with_headers(BTreeMap::from([(
                "X-Tenant".to_owned(),
                vec!["acme".to_owned()],
            )]))
            .with_header("Subject", vec!["Re: Hi".to_owned()]);

        assert_eq!(
            rule_message.read_field("header:x-tenant"),
            Some(vec!["acme".to_owned()])
        );
        assert_eq!(
            rule_message.read_field("header:subject"),
            Some(vec!["Re: Hi".to_owned()])
        );
    }
}
