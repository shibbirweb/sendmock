use sendmock_store::WebhookEndpointRecord;
use sendmock_webhooks::{WebhookSecret, build_signed_headers};

use crate::{OperationError, RecordedHttpRequest};

/// The secrets that sign at `now_unix_ms`: the current one, and the previous one while its
/// rotation overlap lasts (WH-04.3).
fn read_signing_secrets(
    stored_endpoint: &WebhookEndpointRecord,
    now_unix_ms: i64,
) -> Result<Vec<WebhookSecret>, OperationError> {
    let previous_secret = stored_endpoint
        .previous_signing_secret
        .as_ref()
        .filter(|_| {
            stored_endpoint
                .previous_secret_expires_at_unix_ms
                .is_some_and(|expires_at_unix_ms| expires_at_unix_ms > now_unix_ms)
        });
    std::iter::once(&stored_endpoint.signing_secret)
        .chain(previous_secret)
        .map(|encoded_secret| {
            WebhookSecret::parse(encoded_secret)
                .map_err(|secret_error| OperationError::Internal(secret_error.to_string()))
        })
        .collect()
}

/// The rendered request with the Standard Webhooks headers of this attempt (WH-04.1):
/// `webhook-id` is the event id on every attempt, the timestamp is the attempt's.
pub fn sign_delivery_request(
    rendered_request: &RecordedHttpRequest,
    stored_endpoint: &WebhookEndpointRecord,
    event_id: &str,
    attempt: u32,
    now_unix_ms: i64,
) -> Result<RecordedHttpRequest, OperationError> {
    let signing_secrets = read_signing_secrets(stored_endpoint, now_unix_ms)?;
    let secret_references: Vec<&WebhookSecret> = signing_secrets.iter().collect();
    let signed_headers = build_signed_headers(
        &secret_references,
        event_id,
        now_unix_ms.div_euclid(1_000),
        &rendered_request.body,
    );
    let mut sent_request = rendered_request.clone();
    sent_request
        .headers
        .insert("webhook-id".to_owned(), signed_headers.webhook_id);
    sent_request.headers.insert(
        "webhook-timestamp".to_owned(),
        signed_headers.webhook_timestamp,
    );
    sent_request.headers.insert(
        "webhook-signature".to_owned(),
        signed_headers.webhook_signature,
    );
    sent_request
        .headers
        .insert("webhook-attempt".to_owned(), attempt.to_string());
    Ok(sent_request)
}
