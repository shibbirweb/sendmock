//! Secret variable values are sent as they are but never shown: a recorded request and the
//! preview show `••••••` in their place
//! ([12](docs/plan/12-webhook-variables.md#storage-and-logs)).

use crate::{OperationContext, OperationError, RecordedHttpRequest};

pub const MASKED_SECRET_TEXT: &str = "••••••";
/// Shorter values are not masked, since replacing one or two characters everywhere would
/// garble the request without hiding anything worth hiding.
const MINIMUM_MASKED_LENGTH: usize = 4;

/// The value of every secret variable, longest first so a longer one is masked whole.
pub async fn load_secret_values(
    operation_context: &OperationContext,
) -> Result<Vec<String>, OperationError> {
    let mut secret_values: Vec<String> = operation_context
        .webhook_variable_repository
        .list_variables(None)
        .await?
        .into_iter()
        .filter(|stored_variable| stored_variable.kind == "secret")
        .map(|stored_variable| stored_variable.value)
        .filter(|secret_value| secret_value.chars().count() >= MINIMUM_MASKED_LENGTH)
        .collect();
    secret_values.sort_by_key(|secret_value| std::cmp::Reverse(secret_value.len()));
    secret_values.dedup();
    Ok(secret_values)
}

pub fn mask_secret_text(shown_text: &str, secret_values: &[String]) -> String {
    secret_values
        .iter()
        .fold(shown_text.to_owned(), |masked_text, secret_value| {
            masked_text.replace(secret_value.as_str(), MASKED_SECRET_TEXT)
        })
}

pub fn mask_request_secrets(
    shown_request: &RecordedHttpRequest,
    secret_values: &[String],
) -> RecordedHttpRequest {
    RecordedHttpRequest {
        method: shown_request.method.clone(),
        url: mask_secret_text(&shown_request.url, secret_values),
        headers: shown_request
            .headers
            .iter()
            .map(|(header_name, header_value)| {
                (
                    header_name.clone(),
                    mask_secret_text(header_value, secret_values),
                )
            })
            .collect(),
        body: mask_secret_text(&shown_request.body, secret_values),
    }
}
