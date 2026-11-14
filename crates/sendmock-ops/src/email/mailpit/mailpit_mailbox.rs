//! Mailpit's API requests answered from SendMock's mail, through the same operations the
//! native API uses, so events, the UI and webhooks see the same changes.

use std::collections::BTreeMap;

use sendmock_store::{EmailListFilter, EmailRecord};

use super::super::change_email_operations::{
    DeleteAllEmailsOperation, DeleteEmailOperation, UpdateEmailOperation,
};
use super::super::email_file_operations::read_raw_message;
use super::super::email_inputs::{
    EmailFilterQuery, EmailListQuery, EmailReference, EmailUpdateInput,
};
use super::super::email_search_query::build_email_list_filter;
use sendmock_core::compute_file_checksums;

use super::mailpit_shapes::{
    ChecksumsByIndex, MailpitMessage, MailpitMessageSummary, MailpitMessagesSummary, read_html_part,
};
use crate::{Operation, OperationContext, OperationError};

/// Mailpit's word for the newest message, in place of an ID.
const LATEST_MESSAGE_ID: &str = "latest";
/// Mailpit's page size when `limit` is not given.
const DEFAULT_PAGE_SIZE: u32 = 50;
const MAXIMUM_PAGE_SIZE: u32 = 5_000;

/// How a Mailpit request failed, as Mailpit answers it: 404 or 400 with a plain text body.
#[derive(Debug, thiserror::Error)]
pub enum MailpitError {
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    BadRequest(String),
    #[error(transparent)]
    Failed(OperationError),
}

impl From<OperationError> for MailpitError {
    fn from(operation_error: OperationError) -> Self {
        match operation_error {
            OperationError::NotFound { message } => Self::NotFound(message),
            OperationError::InvalidInput { message, .. } => Self::BadRequest(message),
            other_error => Self::Failed(other_error),
        }
    }
}

impl From<sendmock_store::StoreError> for MailpitError {
    fn from(store_error: sendmock_store::StoreError) -> Self {
        Self::Failed(OperationError::from(store_error))
    }
}

fn build_search_filter(search_query: Option<String>) -> EmailListFilter {
    build_email_list_filter(&EmailListQuery {
        query: search_query.filter(|query| !query.trim().is_empty()),
        ..EmailListQuery::default()
    })
}

fn unread_only(mut filter: EmailListFilter) -> EmailListFilter {
    filter.is_unread = Some(true);
    filter
}

/// `GET /api/v1/messages` (no query) and `GET /api/v1/search`.
pub async fn list_mailpit_messages(
    operation_context: &OperationContext,
    search_query: Option<String>,
    start: u64,
    limit: Option<u32>,
) -> Result<MailpitMessagesSummary, MailpitError> {
    let emails = &operation_context.email_repository;
    let search_filter = build_search_filter(search_query);
    let page_size = limit
        .filter(|limit| *limit > 0)
        .unwrap_or(DEFAULT_PAGE_SIZE)
        .min(MAXIMUM_PAGE_SIZE);
    let page_emails = emails
        .list_emails_at_offset(search_filter.clone(), start, page_size)
        .await?;
    Ok(MailpitMessagesSummary {
        total: emails.count_emails(EmailListFilter::default()).await?,
        unread: emails
            .count_emails(unread_only(EmailListFilter::default()))
            .await?,
        messages_count: emails.count_emails(search_filter.clone()).await?,
        messages_unread: emails.count_emails(unread_only(search_filter)).await?,
        start,
        tags: emails.list_email_tags().await?,
        messages: page_emails
            .iter()
            .map(MailpitMessageSummary::from)
            .collect(),
    })
}

/// The message an ID names, or the newest one for `latest`.
pub async fn find_mailpit_email(
    operation_context: &OperationContext,
    message_id: &str,
) -> Result<EmailRecord, MailpitError> {
    let emails = &operation_context.email_repository;
    let found_email = if message_id == LATEST_MESSAGE_ID {
        emails
            .list_emails_at_offset(EmailListFilter::default(), 0, 1)
            .await?
            .into_iter()
            .next()
    } else {
        emails.find_email(message_id).await?
    };
    found_email.ok_or_else(|| MailpitError::NotFound("message not found".to_owned()))
}

async fn update_email(
    operation_context: &OperationContext,
    email_update: EmailUpdateInput,
) -> Result<(), MailpitError> {
    UpdateEmailOperation
        .execute(operation_context, email_update)
        .await?;
    Ok(())
}

/// `GET /api/v1/message/{ID}`: the message, which Mailpit marks read by reading it.
pub async fn read_mailpit_message(
    operation_context: &OperationContext,
    message_id: &str,
) -> Result<MailpitMessage, MailpitError> {
    let email = find_mailpit_email(operation_context, message_id).await?;
    if !email.is_read {
        update_email(
            operation_context,
            EmailUpdateInput {
                email_id: email.email_id.clone(),
                is_read: Some(true),
                tags: None,
            },
        )
        .await?;
    }
    let mut checksums_by_index = ChecksumsByIndex::new();
    for attachment in &email.attachments {
        let stored_content = operation_context
            .email_repository
            .read_attachment_content(&email.email_id, attachment.attachment_index)
            .await?;
        if let Some((_, content)) = stored_content {
            checksums_by_index.insert(
                attachment.attachment_index,
                compute_file_checksums(&content),
            );
        }
    }
    Ok(MailpitMessage::build(&email, &checksums_by_index))
}

/// `GET /api/v1/message/{ID}/headers`, keys in alphabetical order.
pub async fn read_mailpit_headers(
    operation_context: &OperationContext,
    message_id: &str,
) -> Result<BTreeMap<String, Vec<String>>, MailpitError> {
    Ok(find_mailpit_email(operation_context, message_id)
        .await?
        .headers)
}

/// `GET /api/v1/message/{ID}/raw`.
pub async fn read_mailpit_source(
    operation_context: &OperationContext,
    message_id: &str,
) -> Result<Vec<u8>, MailpitError> {
    let email = find_mailpit_email(operation_context, message_id).await?;
    Ok(read_raw_message(operation_context, &email.email_id).await?)
}

/// `GET /api/v1/message/{ID}/part/{PartID}`: the part's content type and bytes.
pub async fn read_mailpit_part(
    operation_context: &OperationContext,
    message_id: &str,
    part_id: &str,
) -> Result<(String, Vec<u8>), MailpitError> {
    let email = find_mailpit_email(operation_context, message_id).await?;
    let attachment_index: u32 = part_id
        .parse()
        .map_err(|_| MailpitError::NotFound("part not found".to_owned()))?;
    let (attachment, content) = operation_context
        .email_repository
        .read_attachment_content(&email.email_id, attachment_index)
        .await?
        .ok_or_else(|| MailpitError::NotFound("part not found".to_owned()))?;
    Ok((attachment.content_type, content))
}

/// `GET /view/{ID}.html` (`is_html`) or `.txt`: the part, or not found when there is none.
pub async fn read_mailpit_view(
    operation_context: &OperationContext,
    message_id: &str,
    is_html: bool,
) -> Result<String, MailpitError> {
    let email = find_mailpit_email(operation_context, message_id).await?;
    let body = if is_html {
        read_html_part(&email)
    } else {
        email.text_body
    };
    body.ok_or_else(|| MailpitError::NotFound("message has no such part".to_owned()))
}

/// `PUT /api/v1/messages`: by IDs, else by search, else every message.
pub async fn set_mailpit_read_status(
    operation_context: &OperationContext,
    message_ids: Vec<String>,
    is_read: bool,
    search_query: Option<String>,
) -> Result<(), MailpitError> {
    if message_ids.is_empty() {
        operation_context
            .email_repository
            .set_read_for_matching(build_search_filter(search_query), is_read)
            .await?;
        return Ok(());
    }
    for email_id in message_ids {
        let email_update = EmailUpdateInput {
            email_id,
            is_read: Some(is_read),
            tags: None,
        };
        update_email(operation_context, email_update).await?;
    }
    Ok(())
}

/// `DELETE /api/v1/messages`: the given IDs, or every message when none are given.
pub async fn delete_mailpit_messages(
    operation_context: &OperationContext,
    message_ids: Vec<String>,
) -> Result<(), MailpitError> {
    if message_ids.is_empty() {
        DeleteAllEmailsOperation
            .execute(operation_context, EmailFilterQuery::default())
            .await?;
        return Ok(());
    }
    for email_id in message_ids {
        DeleteEmailOperation
            .execute(operation_context, EmailReference { email_id })
            .await?;
    }
    Ok(())
}

/// `DELETE /api/v1/search`: the messages matching a search, which must not be empty.
pub async fn delete_mailpit_search(
    operation_context: &OperationContext,
    search_query: Option<String>,
) -> Result<(), MailpitError> {
    let search_query = search_query
        .filter(|query| !query.trim().is_empty())
        .ok_or_else(|| MailpitError::BadRequest("no search query".to_owned()))?;
    DeleteAllEmailsOperation
        .execute(
            operation_context,
            EmailFilterQuery {
                query: Some(search_query),
                ..EmailFilterQuery::default()
            },
        )
        .await?;
    Ok(())
}

/// `GET /api/v1/tags`.
pub async fn list_mailpit_tags(
    operation_context: &OperationContext,
) -> Result<Vec<String>, MailpitError> {
    Ok(operation_context.email_repository.list_email_tags().await?)
}

/// `PUT /api/v1/tags`: replaces each message's tags; an empty list removes them.
pub async fn set_mailpit_tags(
    operation_context: &OperationContext,
    message_ids: Vec<String>,
    tags: Vec<String>,
) -> Result<(), MailpitError> {
    for email_id in message_ids {
        let email_update = EmailUpdateInput {
            email_id,
            is_read: None,
            tags: Some(tags.clone()),
        };
        update_email(operation_context, email_update).await?;
    }
    Ok(())
}
