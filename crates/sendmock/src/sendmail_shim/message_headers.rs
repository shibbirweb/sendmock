/// The addressing headers of a message, read the way `sendmail -t` reads them.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AddressingHeaders {
    pub from_address: Option<String>,
    /// Every address in To, Cc and Bcc, in that order.
    pub recipient_addresses: Vec<String>,
}

/// The header block up to the first blank line, with folded lines joined, as (name, value).
fn read_header_fields(message_text: &str) -> Vec<(String, String)> {
    let mut header_fields: Vec<(String, String)> = Vec::new();
    for header_line in message_text.lines() {
        if header_line.trim().is_empty() {
            break;
        }
        if header_line.starts_with([' ', '\t']) {
            if let Some((_, folded_value)) = header_fields.last_mut() {
                folded_value.push(' ');
                folded_value.push_str(header_line.trim());
            }
            continue;
        }
        if let Some((header_name, header_value)) = header_line.split_once(':') {
            header_fields.push((
                header_name.trim().to_owned(),
                header_value.trim().to_owned(),
            ));
        }
    }
    header_fields
}

pub fn read_addressing_headers(message_text: &str) -> AddressingHeaders {
    let header_fields = read_header_fields(message_text);
    let addresses_of = |wanted_name: &str| -> Vec<String> {
        header_fields
            .iter()
            .filter(|(header_name, _)| header_name.eq_ignore_ascii_case(wanted_name))
            .flat_map(|(_, header_value)| split_address_list(header_value))
            .collect()
    };
    AddressingHeaders {
        from_address: addresses_of("From").into_iter().next(),
        recipient_addresses: ["To", "Cc", "Bcc"]
            .iter()
            .flat_map(|header_name| addresses_of(header_name))
            .collect(),
    }
}

/// The message without its Bcc header, so hidden recipients stay hidden.
pub fn remove_bcc_header(message_text: &str) -> String {
    let mut kept_lines: Vec<&str> = Vec::new();
    let mut is_in_headers = true;
    let mut is_skipping_bcc = false;
    for message_line in message_text.split_inclusive('\n') {
        if is_in_headers && message_line.trim().is_empty() {
            is_in_headers = false;
        }
        if is_in_headers {
            let is_continuation = message_line.starts_with([' ', '\t']);
            if !is_continuation {
                is_skipping_bcc = message_line
                    .split_once(':')
                    .is_some_and(|(header_name, _)| header_name.trim().eq_ignore_ascii_case("Bcc"));
            }
            if is_skipping_bcc {
                continue;
            }
        }
        kept_lines.push(message_line);
    }
    kept_lines.concat()
}

/// `"Doe, Jane" <jane@x.test>, bob@y.test` gives `jane@x.test` and `bob@y.test`.
fn split_address_list(address_list: &str) -> Vec<String> {
    let mut addresses = Vec::new();
    let mut current_entry = String::new();
    let mut is_in_quotes = false;
    for character in address_list.chars() {
        match character {
            '"' => {
                is_in_quotes = !is_in_quotes;
                current_entry.push(character);
            }
            ',' if !is_in_quotes => addresses.extend(read_bare_address(&current_entry)),
            _ => current_entry.push(character),
        }
        if character == ',' && !is_in_quotes {
            current_entry.clear();
        }
    }
    addresses.extend(read_bare_address(&current_entry));
    addresses
}

fn read_bare_address(address_entry: &str) -> Option<String> {
    let address = match (address_entry.rfind('<'), address_entry.rfind('>')) {
        (Some(opening), Some(closing)) if opening < closing => &address_entry[opening + 1..closing],
        _ => address_entry,
    }
    .trim();
    address.contains('@').then(|| address.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    const MESSAGE: &str = "From: Shop <app@shop.test>\nTo: \"Doe, Jane\" <jane@x.test>,\n  bob@y.test\nCc: carol@z.test\nBcc: hidden@w.test\nSubject: Hi\n\nBcc: not a header\n";

    // AC: EM-06.1
    #[test]
    fn reads_every_recipient_header_and_the_sender() {
        let addressing_headers = read_addressing_headers(MESSAGE);

        assert_eq!(
            addressing_headers.from_address.as_deref(),
            Some("app@shop.test")
        );
        assert_eq!(
            addressing_headers.recipient_addresses,
            ["jane@x.test", "bob@y.test", "carol@z.test", "hidden@w.test"]
        );
    }

    #[test]
    fn removes_only_the_bcc_header() {
        let without_bcc = remove_bcc_header(MESSAGE);

        assert!(!without_bcc.contains("hidden@w.test"));
        assert!(without_bcc.contains("Bcc: not a header"));
        assert!(without_bcc.contains("Cc: carol@z.test"));
    }
}
