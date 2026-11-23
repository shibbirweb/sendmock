use std::collections::BTreeMap;

/// A request to a provider path, after the `/providers/<key>` prefix is taken off.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ProviderHttpRequest {
    pub method: String,
    pub path: String,
    pub query_string: Option<String>,
    /// Names in lowercase.
    pub headers: BTreeMap<String, String>,
    pub body: Vec<u8>,
}

impl ProviderHttpRequest {
    pub fn header(&self, header_name: &str) -> Option<&str> {
        self.headers
            .get(&header_name.to_ascii_lowercase())
            .map(String::as_str)
    }

    /// The `Host` header without its port.
    pub fn host(&self) -> Option<&str> {
        self.header("host")
            .map(|host| host.split(':').next().unwrap_or(host))
    }
}

/// A request path with each segment's `%XX` escapes decoded, so `user%40example.org` matches
/// as `user@example.org` on every provider route. An escaped `/` (`%2F`) stays escaped, so a
/// value never splits into two segments; a malformed escape stays as written.
pub fn decode_path_segments(request_path: &str) -> String {
    request_path
        .split('/')
        .map(decode_path_segment)
        .collect::<Vec<_>>()
        .join("/")
}

fn decode_path_segment(path_segment: &str) -> String {
    let segment_bytes = path_segment.as_bytes();
    let mut decoded_bytes = Vec::with_capacity(segment_bytes.len());
    let mut byte_index = 0;
    while byte_index < segment_bytes.len() {
        let escaped_byte = segment_bytes
            .get(byte_index + 1..byte_index + 3)
            .filter(|_| segment_bytes[byte_index] == b'%')
            .and_then(|hex_digits| std::str::from_utf8(hex_digits).ok())
            .and_then(|hex_digits| u8::from_str_radix(hex_digits, 16).ok())
            .filter(|decoded_byte| *decoded_byte != b'/');
        match escaped_byte {
            Some(decoded_byte) => {
                decoded_bytes.push(decoded_byte);
                byte_index += 3;
            }
            None => {
                decoded_bytes.push(segment_bytes[byte_index]);
                byte_index += 1;
            }
        }
    }
    String::from_utf8(decoded_bytes).unwrap_or_else(|_| path_segment.to_owned())
}

/// What SendMock answers, as the provider would.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderHttpResponse {
    pub status: u16,
    pub headers: Vec<(String, String)>,
    pub body: String,
}

impl ProviderHttpResponse {
    /// SendMock's own `404`, for a path no enabled provider answers.
    pub fn native_not_found(message: &str) -> Self {
        Self {
            status: 404,
            headers: vec![("Content-Type".to_owned(), "application/json".to_owned())],
            body: serde_json::json!({ "error": { "code": "not_found", "message": message } })
                .to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: EM-24.4
    #[test]
    fn escapes_in_a_path_segment_are_decoded() {
        assert_eq!(
            decode_path_segments("/v3/mg.shop.test/complaints/user%40example.org"),
            "/v3/mg.shop.test/complaints/user@example.org"
        );
        assert_eq!(decode_path_segments("/a/b%20c"), "/a/b c");
    }

    #[test]
    fn an_escaped_slash_and_a_malformed_escape_stay_as_written() {
        assert_eq!(decode_path_segments("/files/a%2Fb"), "/files/a%2Fb");
        assert_eq!(decode_path_segments("/x/100%"), "/x/100%");
        assert_eq!(decode_path_segments("/x/%zz"), "/x/%zz");
    }
}
