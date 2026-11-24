//! The fields inbound formats such as Mailgun's store-and-notify forward read beyond the
//! stored email: the reply headers, every header as a name and value pair, the text without
//! its quoted reply and signature, the inline parts by content id, and where the message is
//! read back.

use std::collections::BTreeMap;

use serde_json::{Map, Value, json};

use sendmock_store::EmailRecord;

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

/// The address that received an email, as Mailgun's `recipient` names it: the first envelope
/// recipient with an address (else the first `To`), or empty when there is none, so a `To`
/// entry without an address is never sent.
pub fn find_receiving_address(stored_email: &EmailRecord) -> String {
    pick_receiving_address(list_recipient_addresses(stored_email))
        .unwrap_or_default()
        .to_owned()
}

/// The domain that received an email, as Mailgun names it in an inbound message's
/// `message-url`: the receiving address's, or `inbound` when there is none.
pub fn find_receiving_domain(stored_email: &EmailRecord) -> String {
    pick_receiving_domain(list_recipient_addresses(stored_email))
}

fn list_recipient_addresses(stored_email: &EmailRecord) -> impl Iterator<Item = &str> {
    stored_email.envelope_to.iter().map(String::as_str).chain(
        stored_email
            .to
            .iter()
            .map(|recipient| recipient.address.as_str()),
    )
}

fn pick_receiving_address<'address>(
    recipient_addresses: impl Iterator<Item = &'address str>,
) -> Option<&'address str> {
    recipient_addresses.map(str::trim).find(|address| {
        address
            .rsplit_once('@')
            .is_some_and(|(_, domain)| !domain.trim().is_empty())
    })
}

fn pick_receiving_domain<'address>(
    recipient_addresses: impl Iterator<Item = &'address str>,
) -> String {
    pick_receiving_address(recipient_addresses)
        .and_then(|address| address.rsplit_once('@'))
        .map_or("inbound", |(_, domain)| domain.trim())
        .to_owned()
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

    // AC: EM-26.6
    #[test]
    fn the_receiving_domain_comes_from_the_first_recipient() {
        assert_eq!(
            pick_receiving_domain(["support@mg.shop.test", "sam@other.test"].into_iter()),
            "mg.shop.test"
        );
        assert_eq!(pick_receiving_domain(["no-at-sign"].into_iter()), "inbound");
        assert_eq!(pick_receiving_domain(std::iter::empty()), "inbound");
    }

    // AC: EM-25.7
    #[test]
    fn the_receiving_address_skips_entries_without_an_address() {
        assert_eq!(
            pick_receiving_address(["", "[ABC] Pat Lee", " office@example.test "].into_iter()),
            Some("office@example.test")
        );
        assert_eq!(
            pick_receiving_address(["no-at-sign", "a@"].into_iter()),
            None
        );
    }

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
