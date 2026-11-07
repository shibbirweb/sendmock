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

#[cfg(test)]
mod tests {
    use super::*;

    fn answer_with_body(body: Vec<u8>) -> reqwest::Response {
        let http_answer = axum::http::Response::builder()
            .status(502)
            .header("content-type", "text/plain")
            .body(body)
            .unwrap_or_default();
        reqwest::Response::from(http_answer)
    }

    // AC: WH-03.5
    #[tokio::test]
    async fn a_body_past_64_kb_is_cut_and_flagged() {
        let recorded = record_response(answer_with_body(vec![b'x'; 70_000])).await;

        assert_eq!(recorded.status_code, 502);
        assert_eq!(recorded.headers["content-type"], "text/plain");
        assert_eq!(recorded.body.len(), 65_536);
        assert!(recorded.is_body_truncated);
    }

    // AC: WH-03.5
    #[tokio::test]
    async fn a_body_within_64_kb_is_kept_whole() {
        let recorded = record_response(answer_with_body(b"Bad gateway".to_vec())).await;

        assert_eq!(recorded.body, "Bad gateway");
        assert!(!recorded.is_body_truncated);
    }
}
