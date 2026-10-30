use std::collections::BTreeMap;

use sendmock_ops::RecordedHttpResponse;

/// Enough of the answer to debug a handler, without storing large pages (WH-03.5).
const MAXIMUM_RECORDED_BODY_BYTES: usize = 64 * 1024;

/// The answer as SendMock records it: status, headers and the body up to 64 KB, flagged when
/// it was cut.
pub async fn record_response(response: reqwest::Response) -> RecordedHttpResponse {
    let status_code = response.status().as_u16();
    let headers: BTreeMap<String, String> = response
        .headers()
        .iter()
        .filter_map(|(header_name, header_value)| {
            Some((
                header_name.to_string(),
                header_value.to_str().ok()?.to_owned(),
            ))
        })
        .collect();
    let body_bytes = response.bytes().await.unwrap_or_default();
    let is_body_truncated = body_bytes.len() > MAXIMUM_RECORDED_BODY_BYTES;
    let recorded_bytes = &body_bytes[..body_bytes.len().min(MAXIMUM_RECORDED_BODY_BYTES)];
    RecordedHttpResponse {
        status_code,
        headers,
        body: String::from_utf8_lossy(recorded_bytes).into_owned(),
        is_body_truncated,
    }
}
