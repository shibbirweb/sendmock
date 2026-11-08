//! The `raw` message part: a whole MIME message in base64, as SES v2's `Content.Raw.Data`
//! carries it.

use std::collections::BTreeMap;

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use sendmock_mail::parse_email;
use sendmock_store::StoredEmailAddress;

use super::request_checks::ProviderFailure;

const RAW_PART: &str = "raw";

/// The decoded raw message: `None` without a `raw` part, the provider's `invalid_value` when
/// it is not base64.
pub fn decode_raw_part(
    part_values: &BTreeMap<String, Vec<String>>,
) -> Option<Result<Vec<u8>, ProviderFailure>> {
    let encoded_message = part_values.get(RAW_PART)?.first()?;
    Some(STANDARD.decode(encoded_message.trim()).map_err(|_| {
        ProviderFailure::new(
            "invalid_value",
            RAW_PART,
            "The raw message is not base64".to_owned(),
        )
    }))
}

fn read_addresses(addresses: &[StoredEmailAddress]) -> Vec<String> {
    addresses
        .iter()
        .map(|address| address.address.clone())
        .collect()
}

/// The parts the request leaves out are read from the raw message, as the provider takes the
/// sender, recipients and subject from its headers when the request does not name them.
pub fn fill_parts_from_raw_message(part_values: &mut BTreeMap<String, Vec<String>>) {
    let Some(Ok(raw_message)) = decode_raw_part(part_values) else {
        return;
    };
    let parsed_email = parse_email(&raw_message);
    let raw_parts = [
        ("from", vec![parsed_email.from.address.clone()]),
        ("to", read_addresses(&parsed_email.to)),
        ("cc", read_addresses(&parsed_email.cc)),
        ("subject", vec![parsed_email.subject.clone()]),
        ("text", parsed_email.text_body.into_iter().collect()),
        ("html", parsed_email.html_body.into_iter().collect()),
    ];
    for (part, raw_values) in raw_parts {
        let raw_values: Vec<String> = raw_values
            .into_iter()
            .filter(|raw_value| !raw_value.is_empty())
            .collect();
        if !raw_values.is_empty() {
            part_values.entry(part.to_owned()).or_insert(raw_values);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RAW_MESSAGE: &str = "From: Shop <shop@example.test>\r\nTo: sam@example.test\r\nSubject: Raw from SES\r\n\r\nHello";

    fn part_values_with(parts: &[(&str, &str)]) -> BTreeMap<String, Vec<String>> {
        parts
            .iter()
            .map(|(part, part_value)| ((*part).to_owned(), vec![(*part_value).to_owned()]))
            .collect()
    }

    // AC: EM-08.1
    #[test]
    fn the_raw_message_fills_the_parts_the_request_leaves_out() {
        let mut part_values = part_values_with(&[
            ("raw", &STANDARD.encode(RAW_MESSAGE)),
            ("to", "ops@example.test"),
        ]);

        fill_parts_from_raw_message(&mut part_values);

        assert_eq!(part_values["from"], ["shop@example.test"]);
        assert_eq!(part_values["to"], ["ops@example.test"]);
        assert_eq!(part_values["subject"], ["Raw from SES"]);
        assert_eq!(part_values["text"], ["Hello"]);
    }

    #[test]
    fn a_raw_part_that_is_not_base64_is_an_invalid_value() {
        let part_values = part_values_with(&[("raw", "not base64!")]);

        let decoded = decode_raw_part(&part_values);

        assert_eq!(
            decoded.and_then(Result::err).map(|failure| failure.part),
            Some("raw".to_owned())
        );
    }
}
