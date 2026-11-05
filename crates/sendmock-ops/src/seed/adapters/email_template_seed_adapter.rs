use sendmock_store::EmailLocalTemplateRecord;
use serde::{Deserialize, Serialize};

use crate::seed::seed_section_adapter::{
    SeedItem, impl_seed_section_adapter, read_seed_table, write_seed_table,
};
use crate::seed::seed_sections::EMAIL_TEMPLATES_SECTION;
use crate::{OperationContext, OperationError};

/// `[[email.templates]]`, matched by `id`: the provider's template id (SendGrid's `d-...`,
/// Postmark's number or alias), with a subject and a text or HTML body rendered from the send's
/// template data.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct SeedEmailTemplate {
    id: String,
    #[serde(default)]
    subject: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    text: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    html: Option<String>,
}

fn read_local_template(
    seed_template: SeedEmailTemplate,
) -> Result<EmailLocalTemplateRecord, OperationError> {
    let template_id = seed_template.id.trim().to_owned();
    if template_id.is_empty() {
        return Err(OperationError::InvalidInput {
            message: "An email template needs its provider's template `id`".to_owned(),
            field: Some("id".to_owned()),
        });
    }
    if seed_template.text.is_none() && seed_template.html.is_none() {
        return Err(OperationError::InvalidInput {
            message: format!("The email template {template_id} needs a `text` or `html` body"),
            field: Some("text".to_owned()),
        });
    }
    Ok(EmailLocalTemplateRecord {
        template_id,
        subject: seed_template.subject,
        text_body: seed_template.text,
        html_body: seed_template.html,
    })
}

pub struct EmailTemplateSeedAdapter;

impl EmailTemplateSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let local_template = read_local_template(read_seed_table(item_table)?)?;
        let item_key = local_template.template_id.clone();
        operation_context
            .email_provider_stores
            .local_templates
            .save_template(local_template)
            .await?;
        Ok(item_key)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let local_templates = operation_context
            .email_provider_stores
            .local_templates
            .list_templates()
            .await?;
        local_templates
            .into_iter()
            .map(|local_template| {
                Ok(SeedItem {
                    item_key: local_template.template_id.clone(),
                    item_name: local_template.template_id.clone(),
                    table: write_seed_table(&SeedEmailTemplate {
                        id: local_template.template_id,
                        subject: local_template.subject,
                        text: local_template.text_body,
                        html: local_template.html_body,
                    })?,
                })
            })
            .collect()
    }

    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let local_templates = &operation_context.email_provider_stores.local_templates;
        for local_template in local_templates.list_templates().await? {
            if !kept_item_keys.contains(&local_template.template_id) {
                local_templates
                    .delete_template(&local_template.template_id)
                    .await?;
            }
        }
        Ok(())
    }
}

impl_seed_section_adapter!(EmailTemplateSeedAdapter, EMAIL_TEMPLATES_SECTION);
