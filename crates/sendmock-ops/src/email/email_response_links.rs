use sendmock_core::format_rfc3339;
use sendmock_store::EmailRecord;
use serde_json::{Value, json};

use super::email_detail::EmailDetail;
use super::email_summary::EmailAddress;
use crate::{OperationContext, OperationError};

fn build_response_link(response_kind: &str, linked_email: &EmailRecord) -> Value {
    json!({
        "kind": response_kind,
        "email_id": linked_email.email_id,
        "subject": linked_email.subject,
        "from": EmailAddress::from(&linked_email.from),
        "received_at": format_rfc3339(linked_email.received_at_unix_ms),
    })
}

/// The reply or forward's link back to its original, and the original's links to its replies
/// and forwards; links to deleted emails are left out (EM-17.3, EM-17.5).
pub async fn attach_response_links(
    operation_context: &OperationContext,
    email_detail: &mut EmailDetail,
) -> Result<(), OperationError> {
    let email_responses = &operation_context.email_stores.responses;
    if let Some(response) = email_responses.find_response(&email_detail.id).await? {
        email_detail.response_kind = Some(response.response_kind.clone());
        email_detail.response_to = operation_context
            .email_repository
            .find_email(&response.original_email_id)
            .await?
            .map(|original_email| build_response_link(&response.response_kind, &original_email));
    }
    for response in email_responses.list_responses(&email_detail.id).await? {
        if let Some(response_email) = operation_context
            .email_repository
            .find_email(&response.email_id)
            .await?
        {
            email_detail.responses.push(build_response_link(
                &response.response_kind,
                &response_email,
            ));
        }
    }
    Ok(())
}
