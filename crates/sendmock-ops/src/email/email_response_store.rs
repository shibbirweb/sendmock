//! Stores a recipient's simulated reply or forward as incoming mail linked to its original.

use std::collections::BTreeMap;

use sendmock_store::{EmailRecord, EmailResponseRecord, TimelineRecord};

use super::email_detail::EmailDetail;
use super::inbound_email_store::store_inbound_message;
use super::native_send_request::{NativeSendAttachment, NativeSendRequest};
use super::read_email_operations::load_email_detail;
use super::response_text::{
    build_forwarded_message_block, build_response_subject, quote_original_email,
};
use crate::{OperationContext, OperationError, complete_email_intake};

/// What one reply or forward says and who it goes to.
pub struct EmailResponseSpec {
    pub is_forward: bool,
    pub from: String,
    pub to: Vec<String>,
    pub cc: Vec<String>,
    pub subject: Option<String>,
    pub body: String,
    pub includes_original_text: bool,
    pub attachments: Vec<NativeSendAttachment>,
}

/// Only mail your app sent is answered (EM-17.5).
pub fn check_original_is_outbound(original_email: &EmailRecord) -> Result<(), OperationError> {
    if original_email.direction == "inbound" {
        return Err(OperationError::Conflict {
            code: "conflict",
            message: "Only emails your app sent can be replied to or forwarded".to_owned(),
        });
    }
    Ok(())
}

/// `In-Reply-To` and `References` for a reply; a forward links to the original only through
/// `References`, as mail clients do.
fn build_threading_headers(
    original_email: &EmailRecord,
    is_forward: bool,
) -> BTreeMap<String, String> {
    let Some(original_message_id) = &original_email.message_id else {
        return BTreeMap::new();
    };
    let original_reference = format!("<{original_message_id}>");
    let references: Vec<String> = original_email
        .headers
        .get("References")
        .into_iter()
        .flatten()
        .cloned()
        .chain([original_reference.clone()])
        .collect();
    let mut threading_headers = BTreeMap::from([("References".to_owned(), references.join(" "))]);
    if !is_forward {
        threading_headers.insert("In-Reply-To".to_owned(), original_reference);
    }
    threading_headers
}

fn build_response_text(original_email: &EmailRecord, response_spec: &EmailResponseSpec) -> String {
    let mut response_parts = vec![response_spec.body.trim().to_owned()];
    if response_spec.includes_original_text {
        response_parts.push(if response_spec.is_forward {
            build_forwarded_message_block(original_email)
        } else {
            quote_original_email(original_email)
        });
    }
    response_parts.retain(|response_part| !response_part.is_empty());
    response_parts.join("\n\n")
}

/// Stores the response, links it both ways, notes it on the original's timeline and announces
/// it as `email.inbound`; answers the response's detail.
pub async fn store_email_response(
    operation_context: &OperationContext,
    original_email: &EmailRecord,
    response_spec: EmailResponseSpec,
) -> Result<EmailDetail, OperationError> {
    let send_request = NativeSendRequest {
        from: response_spec.from.clone(),
        to: response_spec.to.clone(),
        cc: Some(response_spec.cc.clone()).filter(|cc| !cc.is_empty()),
        bcc: None,
        subject: response_spec.subject.clone().unwrap_or_else(|| {
            build_response_subject(&original_email.subject, response_spec.is_forward)
        }),
        text: Some(build_response_text(original_email, &response_spec)),
        html: None,
        headers: Some(build_threading_headers(
            original_email,
            response_spec.is_forward,
        ))
        .filter(|headers| !headers.is_empty()),
        tags: None,
        attachments: Some(response_spec.attachments.clone()).filter(|files| !files.is_empty()),
    };
    let response_email = store_inbound_message(operation_context, &send_request).await?;
    let response_kind = if response_spec.is_forward {
        "forward"
    } else {
        "reply"
    };
    operation_context
        .email_stores
        .responses
        .save_response(EmailResponseRecord {
            email_id: response_email.email_id.clone(),
            response_kind: response_kind.to_owned(),
            original_email_id: original_email.email_id.clone(),
        })
        .await?;
    note_response_on_original(
        operation_context,
        original_email,
        &response_email,
        response_spec.is_forward,
    )
    .await?;
    complete_email_intake(operation_context, &response_email).await?;
    load_email_detail(operation_context, &response_email).await
}

async fn note_response_on_original(
    operation_context: &OperationContext,
    original_email: &EmailRecord,
    response_email: &EmailRecord,
    is_forward: bool,
) -> Result<(), OperationError> {
    let responder = &response_email.from.address;
    let (kind, detail) = if is_forward {
        let recipients: Vec<&str> = response_email
            .to
            .iter()
            .map(|recipient| recipient.address.as_str())
            .collect();
        (
            "forwarded_by_recipient",
            format!("{responder} forwarded it to {}", recipients.join(", ")),
        )
    } else {
        ("replied", format!("{responder} replied"))
    };
    operation_context
        .email_repository
        .add_timeline_entry(
            &original_email.email_id,
            TimelineRecord {
                kind: kind.to_owned(),
                happened_at_unix_ms: operation_context.clock.now_unix_ms(),
                detail,
            },
        )
        .await?;
    Ok(())
}
