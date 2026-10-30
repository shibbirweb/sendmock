//! Built-in templates merged with the stored ones: a stored built-in row is the user's edit of
//! it, a stored custom row is a template of their own.

use sendmock_store::{WebhookTemplateRecord, WebhookTemplateRevisionRecord};

use super::endpoint_view::read_request_settings;
use super::template_catalogue::{find_builtin_template, list_builtin_templates};
use super::template_view::{
    ResolvedTemplate, RevisedTemplate, TemplateCategory, TemplateDraft, TemplateMetadata,
    TemplateSource, WebhookTemplateSummary,
};
use crate::{OperationContext, OperationError};

/// Revisions kept per template (WH-09.5).
const KEPT_REVISION_COUNT: u32 = 20;

fn internal_error(message: impl ToString) -> OperationError {
    OperationError::Internal(message.to_string())
}

fn read_json<T: serde::de::DeserializeOwned>(json_text: &str) -> Result<T, OperationError> {
    serde_json::from_str(json_text).map_err(internal_error)
}

fn write_json(value: &impl serde::Serialize) -> Result<String, OperationError> {
    serde_json::to_string(value).map_err(internal_error)
}

/// A stored row as a template: an edited built-in keeps its gallery details and links.
fn resolve_stored_template(
    stored_template: WebhookTemplateRecord,
) -> Result<ResolvedTemplate, OperationError> {
    let builtin_template = find_builtin_template(&stored_template.template_id)
        .filter(|_| stored_template.source == "builtin");
    let draft = TemplateDraft {
        method: read_json(&format!("\"{}\"", stored_template.method))?,
        content_type: stored_template.content_type,
        header_templates: read_json(&stored_template.header_templates_json)?,
        body_template: stored_template.body_template,
    };
    Ok(match builtin_template {
        Some(builtin_template) => ResolvedTemplate {
            summary: WebhookTemplateSummary {
                revision: stored_template.revision,
                is_modified: true,
                ..builtin_template.summary
            },
            draft,
            ..builtin_template
        },
        None => ResolvedTemplate {
            summary: WebhookTemplateSummary {
                id: stored_template.template_id,
                name: stored_template.name,
                service: stored_template.service,
                category: TemplateCategory::Custom,
                source: TemplateSource::Custom,
                events: read_json(&stored_template.events_json)?,
                description: stored_template.description,
                required_variables: read_json(&stored_template.required_variables_json)?,
                revision: stored_template.revision,
                is_modified: false,
            },
            draft,
            doc_url: None,
            verified_on: None,
        },
    })
}

/// Built-in templates first (edited ones as edited), then custom ones in the order made.
pub async fn list_resolved_templates(
    operation_context: &OperationContext,
) -> Result<Vec<ResolvedTemplate>, OperationError> {
    let mut stored_templates = operation_context
        .webhook_template_repository
        .list_templates()
        .await?;
    let mut resolved_templates = Vec::new();
    for builtin_template in list_builtin_templates() {
        let edited_position = stored_templates
            .iter()
            .position(|stored_template| stored_template.template_id == builtin_template.summary.id);
        resolved_templates.push(match edited_position {
            Some(edited_position) => {
                resolve_stored_template(stored_templates.remove(edited_position))?
            }
            None => builtin_template,
        });
    }
    for stored_template in stored_templates {
        resolved_templates.push(resolve_stored_template(stored_template)?);
    }
    Ok(resolved_templates)
}

pub async fn find_resolved_template(
    operation_context: &OperationContext,
    template_id: &str,
) -> Result<ResolvedTemplate, OperationError> {
    let stored_template = operation_context
        .webhook_template_repository
        .find_template(template_id)
        .await?;
    match stored_template {
        Some(stored_template) => resolve_stored_template(stored_template),
        None => find_builtin_template(template_id).ok_or_else(|| OperationError::NotFound {
            message: format!("No webhook template with id {template_id}"),
        }),
    }
}

/// How many endpoints render this template.
pub async fn count_using_endpoints(
    operation_context: &OperationContext,
    template_id: &str,
) -> Result<u32, OperationError> {
    let stored_endpoints = operation_context
        .webhook_endpoint_repository
        .list_endpoints()
        .await?;
    let mut using_count = 0;
    for stored_endpoint in &stored_endpoints {
        if read_request_settings(stored_endpoint)?.template_id == template_id {
            using_count += 1;
        }
    }
    Ok(using_count)
}

/// Stores the template as it is now and keeps it as its newest revision.
pub async fn store_template_version(
    operation_context: &OperationContext,
    saved_template: &ResolvedTemplate,
) -> Result<(), OperationError> {
    let now_unix_ms = operation_context.clock.now_unix_ms();
    let summary = &saved_template.summary;
    let method_json = write_json(&saved_template.draft.method)?;
    let template_repository = &operation_context.webhook_template_repository;
    template_repository
        .save_template(WebhookTemplateRecord {
            template_id: summary.id.clone(),
            source: write_json(&summary.source)?.trim_matches('"').to_owned(),
            name: summary.name.clone(),
            service: summary.service.clone(),
            description: summary.description.clone(),
            events_json: write_json(&summary.events)?,
            required_variables_json: write_json(&summary.required_variables)?,
            method: method_json.trim_matches('"').to_owned(),
            content_type: saved_template.draft.content_type.clone(),
            header_templates_json: write_json(&saved_template.draft.header_templates)?,
            body_template: saved_template.draft.body_template.clone(),
            revision: summary.revision,
            updated_at_unix_ms: now_unix_ms,
        })
        .await?;
    let revised_template = RevisedTemplate {
        draft: saved_template.draft.clone(),
        metadata: saved_template.metadata(),
    };
    template_repository
        .insert_revision(
            WebhookTemplateRevisionRecord {
                template_id: summary.id.clone(),
                revision: summary.revision,
                saved_at_unix_ms: now_unix_ms,
                template_json: write_json(&revised_template)?,
            },
            KEPT_REVISION_COUNT,
        )
        .await?;
    Ok(())
}

/// "Twilio STOP reply" becomes `custom.twilio_stop_reply`, unique among templates.
async fn build_custom_template_id(
    operation_context: &OperationContext,
    template_name: &str,
) -> Result<String, OperationError> {
    let slug_words: Vec<String> = template_name
        .to_ascii_lowercase()
        .split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|word| !word.is_empty())
        .map(str::to_owned)
        .collect();
    let slug = if slug_words.is_empty() {
        "template".to_owned()
    } else {
        slug_words.join("_")
    };
    let base_id = format!("custom.{slug}");
    let existing_ids: Vec<String> = list_resolved_templates(operation_context)
        .await?
        .into_iter()
        .map(|resolved_template| resolved_template.summary.id)
        .collect();
    let mut candidate_id = base_id.clone();
    let mut suffix = 2;
    while existing_ids.contains(&candidate_id) {
        candidate_id = format!("{base_id}_{suffix}");
        suffix += 1;
    }
    Ok(candidate_id)
}

/// A new custom template at revision 1, with its first revision kept.
pub async fn create_custom_template(
    operation_context: &OperationContext,
    metadata: TemplateMetadata,
    service: String,
    draft: TemplateDraft,
) -> Result<WebhookTemplateSummary, OperationError> {
    let custom_template = ResolvedTemplate {
        summary: WebhookTemplateSummary {
            id: build_custom_template_id(operation_context, &metadata.name).await?,
            name: metadata.name,
            service,
            category: TemplateCategory::Custom,
            source: TemplateSource::Custom,
            events: metadata.events,
            description: metadata.description,
            required_variables: metadata.required_variables,
            revision: 1,
            is_modified: false,
        },
        draft,
        doc_url: None,
        verified_on: None,
    };
    store_template_version(operation_context, &custom_template).await?;
    Ok(custom_template.summary)
}
