use super::template_edit_operations::save_next_version;
use super::template_file::{TemplateFile, parse_template_file, write_template_toml};
use super::template_inputs::{
    ImportConflictChoice, TemplateImportRequest, WebhookTemplateReference,
};
use super::template_operations::{load_template_detail, template_definition};
use super::template_rendering::check_draft_can_be_saved;
use super::template_store::{create_custom_template, find_resolved_template};
use super::template_view::{
    ResolvedTemplate, RevisedTemplate, TemplateMetadata, TemplateSource, WebhookTemplateSummary,
};
use crate::{
    AnswerKind, CliArgument, FileAnswer, HttpMethod, Operation, OperationContext,
    OperationDefinition, OperationError, SuccessStatus,
};

const TEMPLATE_FILE_CONTENT_TYPE: &str = "application/toml";

pub struct ExportWebhookTemplateOperation;

impl Operation for ExportWebhookTemplateOperation {
    type Input = WebhookTemplateReference;
    type Output = FileAnswer;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            answer_kind: AnswerKind::File {
                content_type: TEMPLATE_FILE_CONTENT_TYPE,
            },
            ..template_definition(
                "getWebhooksTemplatesByTemplateIdExport",
                HttpMethod::Get,
                "/api/v1/webhooks/templates/{templateId}/export",
                "The template as TOML (variable names, never values).",
                "sendmock webhook template export <templateId>",
                "sendmock_webhook_template_export",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookTemplateReference,
    ) -> Result<FileAnswer, OperationError> {
        let template_detail = load_template_detail(operation_context, &input.template_id).await?;
        Ok(FileAnswer {
            content_type: TEMPLATE_FILE_CONTENT_TYPE.to_owned(),
            file_name: Some(format!("{}.sendmock-template.toml", input.template_id)),
            bytes: write_template_toml(&template_detail).into_bytes(),
        })
    }
}

fn to_metadata(template_file: &TemplateFile) -> TemplateMetadata {
    TemplateMetadata {
        name: template_file.name.clone(),
        description: "Imported from a template file.".to_owned(),
        events: template_file.events.clone(),
        required_variables: template_file.required_variables.clone(),
    }
}

/// The template the file would replace, unless the import makes a copy anyway.
async fn find_replaced_template(
    operation_context: &OperationContext,
    template_file: &TemplateFile,
    on_conflict: Option<ImportConflictChoice>,
) -> Result<Option<ResolvedTemplate>, OperationError> {
    let Some(template_id) = template_file.template_id.as_deref() else {
        return Ok(None);
    };
    if on_conflict == Some(ImportConflictChoice::Copy) {
        return Ok(None);
    }
    let existing_template = match find_resolved_template(operation_context, template_id).await {
        Ok(existing_template) => existing_template,
        Err(OperationError::NotFound { .. }) => return Ok(None),
        Err(other_error) => return Err(other_error),
    };
    let edits_this_builtin =
        template_file.edits_builtin && existing_template.summary.source == TemplateSource::Builtin;
    if on_conflict != Some(ImportConflictChoice::Replace) && !edits_this_builtin {
        return Err(OperationError::Conflict {
            code: "template_exists",
            message: format!(
                "A template with the id {template_id} exists: {}.",
                existing_template.summary.name
            ),
        });
    }
    Ok(Some(existing_template))
}

pub struct ImportWebhookTemplateOperation;

impl Operation for ImportWebhookTemplateOperation {
    type Input = TemplateImportRequest;
    type Output = WebhookTemplateSummary;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            success_status: SuccessStatus::Created,
            cli_arguments: &[CliArgument {
                placeholder: "file",
                input_name: "file_text",
                reads_file: true,
            }],
            ..template_definition(
                "postWebhooksTemplatesImport",
                HttpMethod::Post,
                "/api/v1/webhooks/templates/import",
                "Import a template file; 409 when the id is taken.",
                "sendmock webhook template import <file>",
                "sendmock_webhook_template_import",
            )
        }
    }

    /// A new custom template, an edit of the built-in the file was exported from, or, when the
    /// id is taken, the next revision of that template or a copy, as chosen.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: TemplateImportRequest,
    ) -> Result<WebhookTemplateSummary, OperationError> {
        let template_file = parse_template_file(&input.file_text).map_err(|message| {
            OperationError::Unprocessable {
                code: "template_invalid",
                message,
            }
        })?;
        let metadata = to_metadata(&template_file);
        let replaced_template =
            find_replaced_template(operation_context, &template_file, input.on_conflict).await?;
        if let Some(replaced_template) = replaced_template {
            let revised_template = RevisedTemplate {
                draft: template_file.draft,
                metadata,
            };
            let saved_detail =
                save_next_version(operation_context, replaced_template, revised_template).await?;
            return Ok(saved_detail.summary);
        }
        check_draft_can_be_saved(operation_context, &template_file.draft, &metadata.events).await?;
        create_custom_template(
            operation_context,
            metadata,
            template_file.service,
            template_file.draft,
        )
        .await
    }
}
