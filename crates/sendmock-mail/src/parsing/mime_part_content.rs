use mail_parser::MessageParser;

use super::mime_tree::describe_content_type;

/// One part of a message, decoded from its transfer encoding, to download from the MIME tab.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MimePartContent {
    pub content_type: String,
    pub file_name: String,
    pub bytes: Vec<u8>,
}

/// `part-1.2.txt` for a part without a file name of its own.
fn build_part_file_name(part_id: &str, content_type: &str) -> String {
    let extension = match content_type.split_once('/').map(|(_, subtype)| subtype) {
        Some("plain") => "txt",
        Some("rfc822") => "eml",
        Some(subtype) if !subtype.is_empty() => subtype,
        _ => "bin",
    };
    format!("part-{part_id}.{extension}")
}

/// The part at a dotted position (`1`, `1.2`), numbered as the MIME tree numbers them.
pub fn find_mime_part_content(raw_message: &[u8], part_id: &str) -> Option<MimePartContent> {
    let message = MessageParser::new().parse(raw_message)?;
    let mut positions = part_id.split('.');
    if positions.next()? != "1" {
        return None;
    }
    let mut part = message.root_part();
    for position in positions {
        let child_index = position.parse::<usize>().ok()?.checked_sub(1)?;
        part = part.children().nth(child_index)?;
    }
    let content_type = describe_content_type(&part);
    let file_name = part.attachment_name().map_or_else(
        || build_part_file_name(part_id, &content_type),
        str::to_owned,
    );
    Some(MimePartContent {
        content_type,
        file_name,
        bytes: part.decoded().into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const RAW_MESSAGE: &[u8] = b"From: a@b.test\r\nTo: c@d.test\r\nSubject: Parts\r\n\
MIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary=\"b\"\r\n\r\n\
--b\r\nContent-Type: text/plain; charset=utf-8\r\n\r\nHello\r\n\
--b\r\nContent-Type: text/plain\r\nContent-Disposition: attachment; filename=\"order.txt\"\r\n\
Content-Transfer-Encoding: base64\r\n\r\nMTA=\r\n--b--\r\n";

    // AC: EM-04.6
    #[test]
    fn finds_a_part_by_its_position_and_decodes_it() {
        let attachment = find_mime_part_content(RAW_MESSAGE, "1.2");
        let body = find_mime_part_content(RAW_MESSAGE, "1.1");

        assert_eq!(
            attachment,
            Some(MimePartContent {
                content_type: "text/plain".to_owned(),
                file_name: "order.txt".to_owned(),
                bytes: b"10".to_vec(),
            })
        );
        assert_eq!(
            body.map(|part| (part.file_name, part.bytes)),
            Some(("part-1.1.txt".to_owned(), b"Hello".to_vec()))
        );
    }

    // AC: EM-04.6
    #[test]
    fn a_position_that_does_not_exist_finds_nothing() {
        assert_eq!(find_mime_part_content(RAW_MESSAGE, "1.3"), None);
        assert_eq!(find_mime_part_content(RAW_MESSAGE, "2"), None);
        assert_eq!(find_mime_part_content(RAW_MESSAGE, "1.0"), None);
        assert_eq!(find_mime_part_content(RAW_MESSAGE, "1.x"), None);
    }
}
