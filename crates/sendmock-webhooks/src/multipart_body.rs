//! `multipart/form-data` bodies whose file parts are fetched from a URL when the request is
//! sent: the stored request holds a placeholder part naming the URL (WH-07.16, WH-12.2).

/// The header of a placeholder part; the sender replaces the part's content with the file.
pub const FILE_URL_HEADER: &str = "X-Sendmock-File-Url";

/// One part of a multipart body as it is stored.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MultipartPart {
    Text {
        name: String,
        value: String,
    },
    FileFromUrl {
        name: String,
        file_name: String,
        url: String,
    },
}

/// The name a fetched file gets: the URL's last path segment, or `file` without one.
pub fn read_file_name(file_url: &str) -> String {
    let without_query = file_url.split(['?', '#']).next().unwrap_or_default();
    let after_scheme = without_query
        .split_once("://")
        .map_or(without_query, |(_, rest)| rest);
    after_scheme
        .split_once('/')
        .and_then(|(_, url_path)| url_path.rsplit('/').find(|segment| !segment.is_empty()))
        .unwrap_or("file")
        .to_owned()
}

fn quote_name(part_name: &str) -> String {
    part_name.replace('"', "'")
}

/// The stored body: text parts as they are, file parts as placeholders with no content.
pub fn write_multipart_body(boundary: &str, parts: &[MultipartPart]) -> String {
    let mut body = String::new();
    for part in parts {
        match part {
            MultipartPart::Text { name, value } => body.push_str(&format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"{}\"\r\n\r\n{value}\r\n",
                quote_name(name)
            )),
            MultipartPart::FileFromUrl { name, file_name, url } => body.push_str(&format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"{}\"; filename=\"{}\"\r\n{FILE_URL_HEADER}: {url}\r\n\r\n\r\n",
                quote_name(name),
                quote_name(file_name)
            )),
        }
    }
    body.push_str(&format!("--{boundary}--\r\n"));
    body
}

/// A fetched file: its bytes and the content type the server answered with.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FetchedFile {
    pub content_type: Option<String>,
    pub content: Vec<u8>,
}

/// The URL of each placeholder part, in order.
pub fn list_file_urls(body: &str) -> Vec<String> {
    let header_prefix = format!("{FILE_URL_HEADER}: ");
    body.split("\r\n")
        .filter_map(|body_line| body_line.strip_prefix(&header_prefix))
        .map(|file_url| file_url.trim().to_owned())
        .collect()
}

/// The bytes to send: each placeholder becomes its file (with a `Content-Type` line), a file
/// that could not be fetched becomes an empty part, and text parts stay as they are.
pub fn assemble_multipart_bytes(
    body: &str,
    fetch_file: &dyn Fn(&str) -> Option<FetchedFile>,
) -> Vec<u8> {
    let header_prefix = format!("{FILE_URL_HEADER}: ");
    let mut assembled = Vec::with_capacity(body.len());
    let mut body_lines = body.split("\r\n").peekable();
    while let Some(body_line) = body_lines.next() {
        let Some(file_url) = body_line.strip_prefix(&header_prefix) else {
            assembled.extend_from_slice(body_line.as_bytes());
            if body_lines.peek().is_some() {
                assembled.extend_from_slice(b"\r\n");
            }
            continue;
        };
        let fetched_file = fetch_file(file_url.trim());
        let content_type = fetched_file
            .as_ref()
            .and_then(|fetched_file| fetched_file.content_type.clone())
            .unwrap_or_else(|| "application/octet-stream".to_owned());
        assembled.extend_from_slice(format!("Content-Type: {content_type}\r\n\r\n").as_bytes());
        assembled.extend_from_slice(
            &fetched_file
                .map(|fetched_file| fetched_file.content)
                .unwrap_or_default(),
        );
        assembled.extend_from_slice(b"\r\n");
        // The placeholder's blank header end and empty content are replaced above.
        body_lines.next();
        body_lines.next();
    }
    assembled
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: WH-07.16
    #[test]
    fn a_placeholder_part_becomes_the_fetched_file_when_sent() {
        let body = write_multipart_body(
            "b",
            &[
                MultipartPart::Text {
                    name: "subject".to_owned(),
                    value: "Hi".to_owned(),
                },
                MultipartPart::FileFromUrl {
                    name: "invoice".to_owned(),
                    file_name: read_file_name("https://files.app.test/invoices/42.pdf?x=1"),
                    url: "https://files.app.test/invoices/42.pdf?x=1".to_owned(),
                },
            ],
        );

        let sent_bytes = assemble_multipart_bytes(&body, &|file_url| {
            (file_url == "https://files.app.test/invoices/42.pdf?x=1").then(|| FetchedFile {
                content_type: Some("application/pdf".to_owned()),
                content: vec![0x25, 0x50, 0xff],
            })
        });

        assert_eq!(
            list_file_urls(&body),
            ["https://files.app.test/invoices/42.pdf?x=1"]
        );
        let mut expected = b"--b\r\nContent-Disposition: form-data; name=\"subject\"\r\n\r\nHi\r\n--b\r\nContent-Disposition: form-data; name=\"invoice\"; filename=\"42.pdf\"\r\nContent-Type: application/pdf\r\n\r\n".to_vec();
        expected.extend_from_slice(&[0x25, 0x50, 0xff]);
        expected.extend_from_slice(b"\r\n--b--\r\n");
        assert_eq!(sent_bytes, expected);
    }

    #[test]
    fn names_a_file_after_the_last_path_segment() {
        assert_eq!(
            read_file_name("https://files.app.test/a/report.csv"),
            "report.csv"
        );
        assert_eq!(read_file_name("https://files.app.test/"), "file");
    }
}
