use super::template_inputs::{TemplateRevisionReference, TemplateUpdate, WebhookTemplateReference};
use super::template_operations::{load_template_detail, template_definition};
use super::template_rendering::check_draft_can_be_saved;
use super::template_store::{find_resolved_template, store_template_version};
use super::template_view::{
    ResolvedTemplate, RevisedTemplate, TemplateMetadata, TemplateRevision, TemplateSource,
    WebhookTemplateDetail, WebhookTemplateSummary,
};
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

/// Saves an edit as the next revision: the request shape always, the details only for
/// custom templates; an edited built-in becomes Modified (WH-09.7 to WH-09.9).
pub(super) async fn save_next_version(
    operation_context: &OperationContext,
    edited_template: ResolvedTemplate,
    revised_template: RevisedTemplate,
) -> Result<WebhookTemplateDetail, OperationError> {
    if edited_template.summary.source == TemplateSource::File {
        return Err(OperationError::Conflict {
            code: "read_only_template",
            message: "File templates are read-only: edit the file, or clone the template."
                .to_owned(),
        });
    }
    let is_custom = edited_template.summary.source == TemplateSource::Custom;
    let metadata = if is_custom {
        revised_template.metadata
    } else {
        edited_template.metadata()
    };
    check_draft_can_be_saved(operation_context, &revised_template.draft, &metadata.events).await?;
    let template_id = edited_template.summary.id.clone();
    let saved_template = ResolvedTemplate {
        summary: WebhookTemplateSummary {
            name: metadata.name,
            description: metadata.description,
            events: metadata.events,
            required_variables: metadata.required_variables,
            revision: edited_template.summary.revision + 1,
            is_modified: !is_custom,
            ..edited_template.summary
        },
        draft: revised_template.draft,
        ..edited_template
    };
    store_template_version(operation_context, &saved_template).await?;
    load_template_detail(operation_context, &template_id).await
}

pub struct UpdateWebhookTemplateOperation;

impl Operation for UpdateWebhookTemplateOperation {
    type Input = TemplateUpdate;
    type Output = WebhookTemplateDetail;

    fn definition(&self) -> OperationDefinition {
        template_definition(
            "patchWebhooksTemplatesByTemplateId",
            HttpMethod::Patch,
            "/api/v1/webhooks/templates/{templateId}",
            "Edit a template; each save keeps a revision, 422 when it does not render.",
            "sendmock webhook template update <templateId>",
            "sendmock_webhook_template_update",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: TemplateUpdate,
    ) -> Result<WebhookTemplateDetail, OperationError> {
        let edited_template = find_resolved_template(operation_context, &input.template_id).await?;
        let stored_metadata = edited_template.metadata();
        let name = match input.name {
            Some(new_name) if new_name.trim().is_empty() => {
                return Err(OperationError::InvalidInput {
                    message: "Enter a name".to_owned(),
                    field: Some("name".to_owned()),
                });
            }
            Some(new_name) => new_name.trim().to_owned(),
            None => stored_metadata.name,
        };
        let revised_template = RevisedTemplate {
            draft: input.draft,
            metadata: TemplateMetadata {
                name,
                description: input.description.unwrap_or(stored_metadata.description),
                events: input.events.unwrap_or(stored_metadata.events),
                required_variables: input
                    .required_variables
                    .unwrap_or(stored_metadata.required_variables),
            },
        };
        save_next_version(operation_context, edited_template, revised_template).await
    }
}

pub struct ResetWebhookTemplateOperation;

impl Operation for ResetWebhookTemplateOperation {
    type Input = WebhookTemplateReference;
    type Output = WebhookTemplateDetail;

    fn definition(&self) -> OperationDefinition {
        template_definition(
            "postWebhooksTemplatesByTemplateIdReset",
            HttpMethod::Post,
            "/api/v1/webhooks/templates/{templateId}/reset",
            "Put an edited built-in template back as shipped.",
            "sendmock webhook template reset <templateId>",
            "sendmock_webhook_template_reset",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookTemplateReference,
    ) -> Result<WebhookTemplateDetail, OperationError> {
        let edited_template = find_resolved_template(operation_context, &input.template_id).await?;
        if !edited_template.summary.is_modified {
            return Err(OperationError::Conflict {
                code: "not_modified",
                message: "Only an edited built-in template can be reset.".to_owned(),
            });
        }
        // Reset removes the edit and its history together.
        operation_context
            .webhook_template_repository
            .delete_template(&input.template_id)
            .await?;
        load_template_detail(operation_context, &input.template_id).await
    }
}

async fn list_template_revisions(
    operation_context: &OperationContext,
    template_id: &str,
) -> Result<Vec<TemplateRevision>, OperationError> {
    find_resolved_template(operation_context, template_id).await?;
    operation_context
        .webhook_template_repository
        .list_revisions(template_id)
        .await?
        .into_iter()
        .map(|stored_revision| {
            Ok(TemplateRevision {
                revision: stored_revision.revision,
                saved_at: sendmock_core::format_rfc3339(stored_revision.saved_at_unix_ms),
                template: serde_json::from_str(&stored_revision.template_json)
                    .map_err(|parse_error| OperationError::Internal(parse_error.to_string()))?,
            })
        })
        .collect()
}

pub struct ListWebhookTemplateRevisionsOperation;

impl Operation for ListWebhookTemplateRevisionsOperation {
    type Input = WebhookTemplateReference;
    type Output = Vec<TemplateRevision>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            is_read_only: true,
            ..template_definition(
                "getWebhooksTemplatesByTemplateIdRevisions",
                HttpMethod::Get,
                "/api/v1/webhooks/templates/{templateId}/revisions",
                "Saved revisions, newest first.",
                "sendmock webhook template history <templateId>",
                "sendmock_webhook_template_revisions",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WebhookTemplateReference,
    ) -> Result<Vec<TemplateRevision>, OperationError> {
        list_template_revisions(operation_context, &input.template_id).await
    }
}

pub struct RestoreWebhookTemplateRevisionOperation;

impl Operation for RestoreWebhookTemplateRevisionOperation {
    type Input = TemplateRevisionReference;
    type Output = WebhookTemplateDetail;

    fn definition(&self) -> OperationDefinition {
        template_definition(
            "postWebhooksTemplatesByTemplateIdRevisionsByRevisionRestore",
            HttpMethod::Post,
            "/api/v1/webhooks/templates/{templateId}/revisions/{revision}/restore",
            "Restore a revision as a new save.",
            "sendmock webhook template restore <templateId> <revision>",
            "sendmock_webhook_template_restore",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: TemplateRevisionReference,
    ) -> Result<WebhookTemplateDetail, OperationError> {
        let restored_revision = list_template_revisions(operation_context, &input.template_id)
            .await?
            .into_iter()
            .find(|kept_revision| kept_revision.revision == input.revision)
            .ok_or_else(|| OperationError::NotFound {
                message: format!(
                    "No revision {} of webhook template {}",
                    input.revision, input.template_id
                ),
            })?;
        let edited_template = find_resolved_template(operation_context, &input.template_id).await?;
        save_next_version(
            operation_context,
            edited_template,
            restored_revision.template,
        )
        .await
    }
}
