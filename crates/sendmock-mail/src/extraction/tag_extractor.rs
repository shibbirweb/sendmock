/// Tags from the `X-Tags` header (Mailpit compatible): comma-separated, trimmed, lowercase.
pub fn extract_header_tags(x_tags_values: &[String]) -> Vec<String> {
    let mut tags: Vec<String> = Vec::new();
    for tag in x_tags_values
        .iter()
        .flat_map(|header_value| header_value.split(','))
    {
        let tag = tag.trim().to_lowercase();
        if !tag.is_empty() && !tags.contains(&tag) {
            tags.push(tag);
        }
    }
    tags
}

/// `user+invoice@app.test` gives `invoice`, for every recipient that has a plus part.
pub fn extract_plus_address_tags<'address>(
    recipient_addresses: impl IntoIterator<Item = &'address str>,
) -> Vec<String> {
    let mut tags: Vec<String> = Vec::new();
    for recipient_address in recipient_addresses {
        let local_part = recipient_address.split('@').next().unwrap_or_default();
        if let Some((_, plus_tag)) = local_part.split_once('+') {
            let tag = plus_tag.to_lowercase();
            if !tag.is_empty() && !tags.contains(&tag) {
                tags.push(tag);
            }
        }
    }
    tags
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: EM-12.1
    #[test]
    fn reads_tags_from_x_tags() {
        assert_eq!(
            extract_header_tags(&["Orders, qa ".to_owned(), "qa,billing".to_owned()]),
            ["orders", "qa", "billing"]
        );
    }

    // AC: EM-12.2
    #[test]
    fn reads_tags_from_plus_addresses() {
        assert_eq!(
            extract_plus_address_tags(["user+Invoice@app.test", "ops@app.test", "a+qa@x.test"]),
            ["invoice", "qa"]
        );
    }
}
