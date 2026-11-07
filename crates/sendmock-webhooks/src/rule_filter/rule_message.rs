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
