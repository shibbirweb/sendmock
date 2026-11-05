use std::collections::BTreeMap;

use serde_json::Value;

use crate::email::{NativeSendAttachment, NativeSendRequest};

/// Where providers keep each attachment field: SendGrid and Resend in lowercase, Postmark in
/// Pascal case, Mailgun's file parts as SendMock reads them.
const ATTACHMENT_NAME_KEYS: [&str; 3] = ["filename", "Name", "name"];
const ATTACHMENT_CONTENT_KEYS: [&str; 2] = ["content", "Content"];
const ATTACHMENT_TYPE_KEYS: [&str; 3] = ["type", "ContentType", "content_type"];
const ATTACHMENT_ID_KEYS: [&str; 2] = ["content_id", "ContentID"];

/// Splits `"Doe, Jane" <jane@x.test>, sam@x.test` into its addresses, as Postmark's `To` and
/// Mailgun's `to` carry several in one field; commas inside quotes or `<...>` do not split.
fn split_address_list(address_list: &str) -> Vec<String> {
    let mut addresses = Vec::new();
    let mut current_address = String::new();
    let (mut is_quoted, mut is_bracketed) = (false, false);
    for character in address_list.chars() {
        match character {
            '"' => is_quoted = !is_quoted,
            '<' => is_bracketed = true,
            '>' => is_bracketed = false,
            ',' if !is_quoted && !is_bracketed => {
                addresses.push(std::mem::take(&mut current_address));
                continue;
            }
            _ => {}
        }
        current_address.push(character);
    }
    addresses.push(current_address);
    addresses
        .into_iter()
        .map(|address| address.trim().to_owned())
        .filter(|address| !address.is_empty())
        .collect()
}

/// The native send request a provider's parts make; a template send without a body gets an
/// empty text body, as the provider renders the template's own.
pub fn build_send_request(part_values: &BTreeMap<String, Vec<String>>) -> NativeSendRequest {
    let read_values = |part: &str| part_values.get(part).cloned().unwrap_or_default();
    let read_first = |part: &str| read_values(part).into_iter().next();
    let read_optional_list =
        |part: &str| Some(read_values(part)).filter(|values| !values.is_empty());
    let read_addresses = |part: &str| {
        read_values(part)
            .iter()
            .flat_map(|address_list| split_address_list(address_list))
            .collect::<Vec<_>>()
    };
    NativeSendRequest {
        from: read_first("from").unwrap_or_default(),
        to: read_addresses("to"),
        cc: Some(read_addresses("cc")).filter(|addresses| !addresses.is_empty()),
        bcc: Some(read_addresses("bcc")).filter(|addresses| !addresses.is_empty()),
        subject: read_first("subject").unwrap_or_default(),
        text: read_first("text").or_else(|| {
            let is_template_send = read_first("template_id").is_some();
            let has_html = read_first("html").is_some();
            (is_template_send && !has_html).then(String::new)
        }),
        html: read_first("html"),
        headers: Some(read_headers(
            &read_values("headers"),
            read_first("reply_to"),
        ))
        .filter(|headers| !headers.is_empty()),
        tags: read_optional_list("tags"),
        attachments: Some(read_values("attachments"))
            .filter(|attachments| !attachments.is_empty())
            .map(|attachments| {
                attachments
                    .iter()
                    .map(|text| read_attachment(text))
                    .collect()
            }),
    }
}

/// `name: value` pairs as the mapping reads `h:*` or a headers object's entries, plus
/// `Reply-To` when the provider sends it as its own field.
fn read_headers(header_texts: &[String], reply_to: Option<String>) -> BTreeMap<String, String> {
    let mut headers: BTreeMap<String, String> = header_texts
        .iter()
        .filter_map(|header_text| {
            if let Ok(Value::Object(header_object)) = serde_json::from_str::<Value>(header_text) {
                return Some(
                    header_object
                        .into_iter()
                        .map(|(name, value)| (name, read_text(&value)))
                        .collect::<Vec<_>>(),
                );
            }
            // Mailgun names a header `h:X-Name`, so its own colon comes after the prefix.
            let unprefixed_text = header_text.trim_start();
            let unprefixed_text = unprefixed_text
                .strip_prefix("h:")
                .unwrap_or(unprefixed_text);
            let (header_name, header_value) = unprefixed_text.split_once(':')?;
            let header_name = header_name.trim().to_owned();
            Some(vec![(header_name, header_value.trim().to_owned())])
        })
        .flatten()
        .collect();
    if let Some(reply_to) = reply_to {
        headers.insert("Reply-To".to_owned(), reply_to);
    }
    headers
}

fn read_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other_value => other_value.to_string(),
    }
}

/// One attachment from the provider's own shape; a missing field fails the native checks,
/// which name it.
fn read_attachment(attachment_text: &str) -> NativeSendAttachment {
    let attachment = serde_json::from_str::<Value>(attachment_text).unwrap_or(Value::Null);
    let read_first_key = |keys: &[&str]| {
        keys.iter()
            .find_map(|key| attachment.get(*key).and_then(Value::as_str))
            .map(str::to_owned)
    };
    NativeSendAttachment {
        filename: read_first_key(&ATTACHMENT_NAME_KEYS).unwrap_or_default(),
        content: read_first_key(&ATTACHMENT_CONTENT_KEYS).unwrap_or_default(),
        content_type: read_first_key(&ATTACHMENT_TYPE_KEYS),
        content_id: read_first_key(&ATTACHMENT_ID_KEYS),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn address_lists_split_on_commas_outside_quotes_and_brackets() {
        assert_eq!(
            split_address_list("\"Doe, Jane\" <jane@shop.test>, sam@shop.test,  "),
            vec!["\"Doe, Jane\" <jane@shop.test>", "sam@shop.test"]
        );
    }

    #[test]
    fn attachments_are_read_from_each_providers_own_keys() {
        let postmark_attachment = read_attachment(
            r#"{"Name": "a.txt", "Content": "aGk=", "ContentType": "text/plain", "ContentID": "cid1"}"#,
        );
        let sendgrid_attachment = read_attachment(
            r#"{"filename": "b.pdf", "content": "JVBE", "type": "application/pdf"}"#,
        );

        assert_eq!(
            (
                postmark_attachment.filename.as_str(),
                postmark_attachment.content_id.as_deref()
            ),
            ("a.txt", Some("cid1"))
        );
        assert_eq!(
            sendgrid_attachment.content_type.as_deref(),
            Some("application/pdf")
        );
    }

    #[test]
    fn mailgun_headers_and_a_reply_to_field_become_headers() {
        let headers = read_headers(
            &["h:X-Campaign: spring".to_owned()],
            Some("support@shop.test".to_owned()),
        );

        assert_eq!(
            headers.get("X-Campaign").map(String::as_str),
            Some("spring")
        );
        assert_eq!(
            headers.get("Reply-To").map(String::as_str),
            Some("support@shop.test")
        );
    }
}
