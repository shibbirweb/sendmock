use sendmock_mail::decompress_raw_message;

use super::email_inputs::{AttachmentReference, EmailReference};
use crate::{
    AnswerKind, FileAnswer, Operation, OperationContext, OperationDefinition, OperationError,
};

fn file_get(
    operation_id: &'static str,
    path: &'static str,
    summary: &'static str,
    cli_usage: &'static str,
    mcp_resource: &'static str,
    content_type: &'static str,
) -> OperationDefinition {
    OperationDefinition {
        operation_id,
        path,
        summary,
        is_read_only: true,
        cli_usage,
        mcp_tool: mcp_resource,
        answer_kind: AnswerKind::File { content_type },
        ..OperationDefinition::DEFAULTS
    }
}

pub struct DownloadRawEmailOperation;

impl Operation for DownloadRawEmailOperation {
    type Input = EmailReference;
    type Output = FileAnswer;

    fn definition(&self) -> OperationDefinition {
        file_get(
            "getEmailsByEmailIdRaw",
            "/api/v1/emails/{emailId}/raw",
            "The raw message source.",
            "sendmock email raw <emailId>",
            "sendmock://emails/{emailId}/raw",
            "message/rfc822",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailReference,
    ) -> Result<FileAnswer, OperationError> {
        let compressed_raw_message = operation_context
            .email_repository
            .read_compressed_raw_message(&input.email_id)
            .await?
            .ok_or_else(|| OperationError::NotFound {
                message: format!("No email with id {}", input.email_id),
            })?;
        Ok(FileAnswer {
            content_type: "message/rfc822".to_owned(),
            file_name: Some(format!("{}.eml", input.email_id)),
            bytes: decompress_raw_message(&compressed_raw_message)
                .map_err(|decode_error| OperationError::Internal(decode_error.to_string()))?,
        })
    }
}

pub struct DownloadAttachmentOperation;

impl Operation for DownloadAttachmentOperation {
    type Input = AttachmentReference;
    type Output = FileAnswer;

    fn definition(&self) -> OperationDefinition {
        file_get(
            "getEmailsByEmailIdAttachmentsByAttachmentIndex",
            "/api/v1/emails/{emailId}/attachments/{attachmentIndex}",
            "Download one attachment.",
            "sendmock email attachments <emailId> <attachmentIndex>",
            "sendmock://emails/{emailId}/attachments/{attachmentIndex}",
            "application/octet-stream",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: AttachmentReference,
    ) -> Result<FileAnswer, OperationError> {
        let (attachment, content) = read_attachment(operation_context, &input).await?;
        Ok(FileAnswer {
            content_type: attachment.content_type,
            file_name: Some(attachment.filename),
            bytes: content,
        })
    }
}

pub struct GetAttachmentThumbnailOperation;

impl Operation for GetAttachmentThumbnailOperation {
    type Input = AttachmentReference;
    type Output = FileAnswer;

    fn definition(&self) -> OperationDefinition {
        file_get(
            "getEmailsByEmailIdPartsByAttachmentIndexThumbnail",
            "/api/v1/emails/{emailId}/parts/{attachmentIndex}/thumbnail",
            "A preview image of an attachment.",
            "sendmock email thumbnail <emailId> <attachmentIndex>",
            "sendmock://emails/{emailId}/parts/{attachmentIndex}/thumbnail",
            "image/*",
        )
    }

    /// The image itself serves as its thumbnail; the browser scales it. Other files have none.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: AttachmentReference,
    ) -> Result<FileAnswer, OperationError> {
        let (attachment, content) = read_attachment(operation_context, &input).await?;
        if !attachment.content_type.starts_with("image/") {
            return Err(OperationError::NotFound {
                message: format!(
                    "{} is not an image, so it has no thumbnail",
                    attachment.filename
                ),
            });
        }
        Ok(FileAnswer {
            content_type: attachment.content_type,
            file_name: None,
            bytes: content,
        })
    }
}

async fn read_attachment(
    operation_context: &OperationContext,
    input: &AttachmentReference,
) -> Result<(sendmock_store::AttachmentRecord, Vec<u8>), OperationError> {
    operation_context
        .email_repository
        .read_attachment_content(&input.email_id, input.attachment_index)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!(
                "Email {} has no attachment {}",
                input.email_id, input.attachment_index
            ),
        })
}
