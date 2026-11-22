//! The fields inbound formats such as Mailgun's store-and-notify forward read beyond the
//! stored email: the reply headers, every header as a name and value pair, the text without
//! its quoted reply and signature, the inline parts by content id, and where the message is
//! read back.

use std::collections::BTreeMap;

use serde_json::{Map, Value, json};

use crate::InstanceDetails;

/// RFC 3676's signature separator, on a line of its own.
const SIGNATURE_SEPARATOR: &str = "\n-- \n";

/// The first value of a header, its name in any case; empty when the email has none.
pub fn read_first_header(headers: &BTreeMap<String, Vec<String>>, header_name: &str) -> String {
    headers
        .iter()
        .find(|(stored_name, _)| stored_name.eq_ignore_ascii_case(header_name))
        .and_then(|(_, header_values)| header_values.first().cloned())
        .unwrap_or_default()
}

/// Every header value as `[name, value]`, as Mailgun's `message-headers` lists them.
pub fn list_header_pairs(headers: &BTreeMap<String, Vec<String>>) -> Vec<[String; 2]> {
    headers
        .iter()
        .flat_map(|(header_name, header_values)| {
            header_values
                .iter()
                .map(move |header_value| [header_name.clone(), header_value.clone()])
        })
        .collect()
}

/// The text without its signature and without the quoted reply below a `>` line or the
/// `On ... wrote:` line before it, and the signature on its own, as Mailgun strips them.
pub fn split_reply_text(text_body: &str) -> (String, String) {
    let (message_text, signature) = match text_body.split_once(SIGNATURE_SEPARATOR) {
        Some((message_text, signature)) => (message_text, signature.trim().to_owned()),
        None => (text_body, String::new()),
    };
    let mut kept_lines: Vec<&str> = Vec::new();
    for line in message_text.lines() {
        if line.trim_start().starts_with('>') {
            break;
        }
        kept_lines.push(line);
    }
    if kept_lines.last().is_some_and(|last_line| {
        last_line.trim_start().starts_with("On ") && last_line.trim_end().ends_with("wrote:")
    }) {
        kept_lines.pop();
    }
    (kept_lines.join("\n").trim().to_owned(), signature)
}

/// Each inline part's content id with the form field Mailgun posts it as (`attachment-1`).
pub fn map_content_ids(attachment_data: &[Value]) -> Map<String, Value> {
    attachment_data
        .iter()
        .enumerate()
        .filter_map(|(attachment_index, attachment)| {
            let content_id = attachment["content_id"]
                .as_str()
                .filter(|content_id| !content_id.is_empty())?;
            Some((
                format!("<{}>", content_id.trim_matches(['<', '>'])),
                json!(format!("attachment-{}", attachment_index + 1)),
            ))
        })
        .collect()
}

/// Where Mailgun's stored-message API reads the message back (`message-url`, the events'
/// `storage.url`): on the provider port when there is one, under `/providers/mailgun` if not.
pub fn build_message_url(
    instance_details: &InstanceDetails,
    sending_domain: &str,
    message_key: &str,
) -> String {
    match &instance_details.provider_address {
        Some(provider_address) => {
            format!("http://{provider_address}/v3/domains/{sending_domain}/messages/{message_key}")
        }
        None => format!(
            "http://{}/providers/mailgun/v3/domains/{sending_domain}/messages/{message_key}",
            instance_details.http_address
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: EM-25.3
    #[test]
    fn the_reply_and_the_signature_are_split_from_the_text() {
        let (stripped_text, signature) = split_reply_text(
            "Thanks, see you then.\n\nOn Mon, Sam wrote:\n> Are we on?\n-- \nAna\nShop team",
        );

        assert_eq!(stripped_text, "Thanks, see you then.");
        assert_eq!(signature, "Ana\nShop team");
        assert_eq!(
            split_reply_text("Plain text"),
            ("Plain text".to_owned(), String::new())
        );
    }

    #[test]
    fn headers_are_read_in_any_case_and_listed_as_pairs() {
        let headers = BTreeMap::from([
            ("In-Reply-To".to_owned(), vec!["<a@shop.test>".to_owned()]),
            (
                "Received".to_owned(),
                vec!["one".to_owned(), "two".to_owned()],
            ),
        ]);

        assert_eq!(read_first_header(&headers, "in-reply-to"), "<a@shop.test>");
        assert_eq!(read_first_header(&headers, "References"), "");
        assert_eq!(list_header_pairs(&headers).len(), 3);
    }

    #[test]
    fn inline_parts_map_their_content_id_to_their_field() {
        let content_ids = map_content_ids(&[
            json!({ "content_id": null }),
            json!({ "content_id": "logo@shop.test" }),
        ]);

        assert_eq!(
            content_ids.get("<logo@shop.test>"),
            Some(&json!("attachment-2"))
        );
        assert_eq!(content_ids.len(), 1);
    }
}
