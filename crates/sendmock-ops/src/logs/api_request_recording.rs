use std::collections::BTreeMap;

use sendmock_store::ApiRequestRecord;
use serde_json::Value;

use crate::{OperationContext, OperationError};

/// Request bodies and responses longer than this are cut, so one huge upload cannot fill the log.
const MAXIMUM_LOGGED_BODY_BYTES: usize = 64 * 1024;
const MASKED_VALUE: &str = "********";
/// Headers that carry credentials; their values never reach the log.
const CREDENTIAL_HEADERS: [&str; 6] = [
    "authorization",
    "proxy-authorization",
    "cookie",
    "x-api-key",
    "api-key",
    "x-auth-token",
];

/// Which API an operation belongs to in the request log, and what its success creates.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RequestLogSettings {
    pub api: &'static str,
    /// `email` or `sms`: the answer's `id` names what the request created.
    pub linked_message_kind: Option<&'static str>,
}

/// A request and the response it got, as the transport saw them.
#[derive(Debug, Clone)]
pub struct CompletedApiRequest {
    pub method: String,
    pub path: String,
    pub request_headers: Vec<(String, String)>,
    pub request_body: Vec<u8>,
    pub response_status: u16,
    pub response_body: Vec<u8>,
    pub duration_ms: u64,
}

/// Masks credentials, caps bodies, links what the request created and stores the entry.
pub async fn record_api_request(
    operation_context: &OperationContext,
    request_log_settings: RequestLogSettings,
    completed_request: CompletedApiRequest,
) -> Result<(), OperationError> {
    let response_body = read_logged_body(&completed_request.response_body);
    let linked_message = request_log_settings
        .linked_message_kind
        .filter(|_| (200..300).contains(&completed_request.response_status))
        .and_then(|linked_message_kind| {
            let created_id = serde_json::from_str::<Value>(&response_body).ok()?["id"]
                .as_str()?
                .to_owned();
            Some((linked_message_kind.to_owned(), created_id))
        });
    let api_request = ApiRequestRecord {
        request_id: operation_context.id_generator.generate_id().to_string(),
        api: request_log_settings.api.to_owned(),
        method: completed_request.method,
        path: completed_request.path,
        request_headers: mask_credential_headers(completed_request.request_headers),
        request_body: read_logged_body(&completed_request.request_body),
        response_status: completed_request.response_status,
        response_body,
        duration_ms: completed_request.duration_ms,
        linked_message,
        created_at_unix_ms: operation_context.clock.now_unix_ms(),
    };
    Ok(operation_context
        .api_request_repository
        .insert_request(api_request)
        .await?)
}

fn mask_credential_headers(request_headers: Vec<(String, String)>) -> BTreeMap<String, String> {
    request_headers
        .into_iter()
        .map(|(header_name, header_value)| {
            let header_name = header_name.to_lowercase();
            if !CREDENTIAL_HEADERS.contains(&header_name.as_str()) {
                return (header_name, header_value);
            }
            let masked_value = match header_value.split_once(' ') {
                Some((auth_scheme, _)) => format!("{auth_scheme} {MASKED_VALUE}"),
                None => MASKED_VALUE.to_owned(),
            };
            (header_name, masked_value)
        })
        .collect()
}

fn read_logged_body(body_bytes: &[u8]) -> String {
    let kept_bytes = &body_bytes[..body_bytes.len().min(MAXIMUM_LOGGED_BODY_BYTES)];
    String::from_utf8_lossy(kept_bytes).into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: SM-13.2
    #[test]
    fn credentials_never_reach_the_log() {
        let masked_headers = mask_credential_headers(vec![
            (
                "Authorization".to_owned(),
                "Basic QUN4eHg6c2VjcmV0".to_owned(),
            ),
            ("X-Api-Key".to_owned(), "sk_live_123".to_owned()),
            ("Content-Type".to_owned(), "application/json".to_owned()),
        ]);

        assert_eq!(masked_headers["authorization"], "Basic ********");
        assert_eq!(masked_headers["x-api-key"], "********");
        assert_eq!(masked_headers["content-type"], "application/json");
    }

    #[test]
    fn long_bodies_are_cut() {
        let long_body = vec![b'a'; MAXIMUM_LOGGED_BODY_BYTES + 10];

        assert_eq!(
            read_logged_body(&long_body).len(),
            MAXIMUM_LOGGED_BODY_BYTES
        );
    }
}
