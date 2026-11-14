use std::io::Read;

use axum::http::HeaderMap;
use axum::http::header::CONTENT_ENCODING;
use flate2::read::GzDecoder;

/// A provider request body as the provider reads it: inflated when the client sent it with
/// `Content-Encoding: gzip`, as `expo-server-sdk` does for bodies over 1 KB. `None` when the
/// body is not valid gzip or inflates past `maximum_body_bytes`.
pub fn decode_request_body(
    headers: &HeaderMap,
    body_bytes: Vec<u8>,
    maximum_body_bytes: usize,
) -> Option<Vec<u8>> {
    let is_gzip = headers
        .get(CONTENT_ENCODING)
        .and_then(|header_value| header_value.to_str().ok())
        .is_some_and(|content_encoding| content_encoding.trim().eq_ignore_ascii_case("gzip"));
    if !is_gzip {
        return Some(body_bytes);
    }
    let mut inflated_bytes = Vec::new();
    let read_limit = u64::try_from(maximum_body_bytes).unwrap_or(u64::MAX) + 1;
    GzDecoder::new(body_bytes.as_slice())
        .take(read_limit)
        .read_to_end(&mut inflated_bytes)
        .ok()?;
    (inflated_bytes.len() <= maximum_body_bytes).then_some(inflated_bytes)
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use axum::http::HeaderValue;
    use flate2::Compression;
    use flate2::write::GzEncoder;

    use super::*;

    fn gzip_headers() -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_ENCODING, HeaderValue::from_static("gzip"));
        headers
    }

    fn compress(plain_bytes: &[u8]) -> Vec<u8> {
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(plain_bytes).unwrap_or_default();
        encoder.finish().unwrap_or_default()
    }

    #[test]
    fn a_plain_body_is_kept_as_sent() {
        let decoded = decode_request_body(&HeaderMap::new(), b"{}".to_vec(), 10);

        assert_eq!(decoded, Some(b"{}".to_vec()));
    }

    #[test]
    fn a_gzip_body_is_inflated() {
        let decoded = decode_request_body(&gzip_headers(), compress(b"{\"to\":1}"), 100);

        assert_eq!(decoded, Some(b"{\"to\":1}".to_vec()));
    }

    #[test]
    fn a_gzip_body_past_the_limit_or_not_gzip_is_refused() {
        let oversized = decode_request_body(&gzip_headers(), compress(&[b'a'; 64]), 10);
        let corrupt = decode_request_body(&gzip_headers(), b"not gzip".to_vec(), 100);

        assert_eq!(oversized, None);
        assert_eq!(corrupt, None);
    }
}
