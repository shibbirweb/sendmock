use rusqlite::types::Value as SqlValue;

/// Which emails a list or search returns; every set condition must hold.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct EmailListFilter {
    /// Words to find anywhere in the subject, addresses or body (prefix matches).
    pub search_text: Option<String>,
    pub from_contains: Option<String>,
    pub to_contains: Option<String>,
    pub subject_contains: Option<String>,
    pub tag: Option<String>,
    pub is_unread: Option<bool>,
    pub has_attachment: Option<bool>,
    pub source: Option<String>,
    pub direction: Option<String>,
    pub received_after_unix_ms: Option<i64>,
}

/// Conditions joined with AND, with their parameters in the same order.
#[derive(Default)]
struct SqlConditions {
    conditions: Vec<&'static str>,
    parameters: Vec<SqlValue>,
}

impl SqlConditions {
    fn add(&mut self, condition: &'static str, parameter: Option<SqlValue>) {
        self.conditions.push(condition);
        self.parameters.extend(parameter);
    }

    fn add_contains(&mut self, condition: &'static str, contained_text: Option<&String>) {
        if let Some(contained_text) = contained_text {
            self.add(
                condition,
                Some(SqlValue::Text(format!("%{}%", escape_like(contained_text)))),
            );
        }
    }
}

impl EmailListFilter {
    /// The SQL conditions and their parameters, joined with AND; `1 = 1` when none are set.
    pub fn to_sql_conditions(&self) -> (String, Vec<SqlValue>) {
        let mut sql_conditions = SqlConditions::default();
        if let Some(fts_query) = self.search_text.as_deref().and_then(build_fts_query) {
            sql_conditions.add(
                "emails.rowid IN (SELECT rowid FROM emails_fts WHERE emails_fts MATCH ?)",
                Some(SqlValue::Text(fts_query)),
            );
        }
        sql_conditions.add_contains("emails.from_address LIKE ?", self.from_contains.as_ref());
        sql_conditions.add_contains(
            "(emails.to_addresses || emails.cc_addresses || emails.bcc_addresses || emails.envelope_to) LIKE ?",
            self.to_contains.as_ref(),
        );
        sql_conditions.add_contains("emails.subject LIKE ?", self.subject_contains.as_ref());
        if let Some(tag) = &self.tag {
            sql_conditions.add(
                "EXISTS (SELECT 1 FROM json_each(emails.tags) WHERE value = ?)",
                Some(SqlValue::Text(tag.to_lowercase())),
            );
        }
        self.add_flag_conditions(&mut sql_conditions);
        if sql_conditions.conditions.is_empty() {
            return ("1 = 1".to_owned(), sql_conditions.parameters);
        }
        (
            sql_conditions.conditions.join(" AND "),
            sql_conditions.parameters,
        )
    }

    fn add_flag_conditions(&self, sql_conditions: &mut SqlConditions) {
        if let Some(is_unread) = self.is_unread {
            sql_conditions.add(
                if is_unread {
                    "emails.is_read = 0"
                } else {
                    "emails.is_read = 1"
                },
                None,
            );
        }
        if let Some(has_attachment) = self.has_attachment {
            let condition = if has_attachment {
                "emails.attachment_count > 0"
            } else {
                "emails.attachment_count = 0"
            };
            sql_conditions.add(condition, None);
        }
        if let Some(source) = &self.source {
            sql_conditions.add("emails.source = ?", Some(SqlValue::Text(source.clone())));
        }
        if let Some(direction) = &self.direction {
            sql_conditions.add(
                "emails.direction = ?",
                Some(SqlValue::Text(direction.clone())),
            );
        }
        if let Some(received_after_unix_ms) = self.received_after_unix_ms {
            sql_conditions.add(
                "emails.received_at > ?",
                Some(SqlValue::Integer(received_after_unix_ms)),
            );
        }
    }
}

/// Each word as a quoted prefix term, so punctuation in search text never breaks FTS5.
fn build_fts_query(search_text: &str) -> Option<String> {
    let terms: Vec<String> = search_text
        .split_whitespace()
        .map(|word| word.replace('"', ""))
        .filter(|word| !word.is_empty())
        .map(|word| format!("\"{word}\"*"))
        .collect();
    (!terms.is_empty()).then(|| terms.join(" "))
}

fn escape_like(contained_text: &str) -> String {
    contained_text.replace(['%', '_'], "")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn no_conditions_match_everything() {
        assert_eq!(
            EmailListFilter::default().to_sql_conditions(),
            ("1 = 1".to_owned(), Vec::new())
        );
    }

    #[test]
    fn quotes_search_words_as_prefix_terms() {
        assert_eq!(
            build_fts_query(r#"reset "pass"word"#).as_deref(),
            Some(r#""reset"* "password"*"#)
        );
        assert_eq!(build_fts_query("   "), None);
    }

    #[test]
    fn joins_every_set_condition() {
        let filter = EmailListFilter {
            tag: Some("QA".to_owned()),
            is_unread: Some(true),
            ..EmailListFilter::default()
        };

        let (conditions, parameters) = filter.to_sql_conditions();

        assert_eq!(
            conditions,
            "EXISTS (SELECT 1 FROM json_each(emails.tags) WHERE value = ?) AND emails.is_read = 0"
        );
        assert_eq!(parameters, vec![SqlValue::Text("qa".to_owned())]);
    }
}
