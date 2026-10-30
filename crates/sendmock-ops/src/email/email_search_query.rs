use sendmock_store::EmailListFilter;

use super::email_inputs::EmailListQuery;

/// The filter a list request asks for: its fields, plus the `from:`, `to:`, `subject:`,
/// `tag:`, `source:`, `is:unread`, `is:read` and `has:attachment` prefixes in `query`; the
/// remaining words are full-text search.
pub fn build_email_list_filter(list_query: &EmailListQuery) -> EmailListFilter {
    let mut filter = EmailListFilter {
        from_contains: list_query.from.clone(),
        to_contains: list_query.to.clone(),
        tag: list_query.tag.clone(),
        is_unread: list_query.is_unread,
        has_attachment: list_query.has_attachment,
        source: list_query.source.clone(),
        direction: list_query.direction.clone(),
        ..EmailListFilter::default()
    };
    let mut search_words: Vec<&str> = Vec::new();
    for query_word in list_query
        .query
        .as_deref()
        .unwrap_or_default()
        .split_whitespace()
    {
        match query_word.split_once(':') {
            Some(("from", value)) if !value.is_empty() => {
                filter.from_contains = Some(value.to_owned())
            }
            Some(("to", value)) if !value.is_empty() => filter.to_contains = Some(value.to_owned()),
            Some(("subject", value)) if !value.is_empty() => {
                filter.subject_contains = Some(value.to_owned())
            }
            Some(("tag", value)) if !value.is_empty() => filter.tag = Some(value.to_owned()),
            Some(("source", value)) if !value.is_empty() => filter.source = Some(value.to_owned()),
            Some(("is", "unread")) => filter.is_unread = Some(true),
            Some(("is", "read")) => filter.is_unread = Some(false),
            Some(("has", "attachment")) => filter.has_attachment = Some(true),
            _ => search_words.push(query_word),
        }
    }
    if !search_words.is_empty() {
        filter.search_text = Some(search_words.join(" "));
    }
    filter
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: EM-03.4
    #[test]
    fn reads_every_prefix_and_keeps_the_rest_as_search_text() {
        let list_query = EmailListQuery {
            query: Some("from:bank to:sam@ subject:reset tag:qa source:smtp is:unread has:attachment password link".to_owned()),
            ..EmailListQuery::default()
        };

        let filter = build_email_list_filter(&list_query);

        assert_eq!(filter.from_contains.as_deref(), Some("bank"));
        assert_eq!(filter.to_contains.as_deref(), Some("sam@"));
        assert_eq!(filter.subject_contains.as_deref(), Some("reset"));
        assert_eq!(filter.tag.as_deref(), Some("qa"));
        assert_eq!(filter.source.as_deref(), Some("smtp"));
        assert_eq!(filter.is_unread, Some(true));
        assert_eq!(filter.has_attachment, Some(true));
        assert_eq!(filter.search_text.as_deref(), Some("password link"));
    }
}
