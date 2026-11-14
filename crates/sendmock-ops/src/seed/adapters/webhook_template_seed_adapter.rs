use crate::seed::seed_section_adapter::{SeedItem, impl_seed_section_adapter};
use crate::seed::seed_sections::WEBHOOK_TEMPLATES_SECTION;
use crate::webhooks::{
    ImportConflictChoice, ImportWebhookTemplateOperation, TemplateFile, TemplateImportRequest,
    TemplateMetadata, TemplateSource, check_draft_can_be_saved, create_custom_template_with_id,
    find_builtin_template, list_resolved_templates, parse_template_file, write_template_toml,
};
use crate::{Operation, OperationContext, OperationError};

/// The keys a template file nests under `[request]`, which a demo export writes at the top.
const REQUEST_KEYS: [&str; 4] = ["method", "content_type", "body", "headers"];

/// `[[webhook.templates]]`: custom templates and edited built-ins, matched by `id`, in the
/// template file format (Webhooks > Templates > Export) with the request under `request`.
pub struct WebhookTemplateSeedAdapter;

impl WebhookTemplateSeedAdapter {
    async fn apply(
        operation_context: &OperationContext,
        item_table: toml::Table,
    ) -> Result<String, OperationError> {
        let file_text = toml::to_string(&nest_request_keys(item_table))
            .map_err(|write_error| OperationError::Internal(write_error.to_string()))?;
        let template_file =
            parse_template_file(&file_text).map_err(|message| OperationError::InvalidInput {
                message,
                field: None,
            })?;
        let Some(template_id) = template_file.template_id.clone() else {
            return Err(OperationError::InvalidInput {
                message: "A seeded template needs its id".to_owned(),
                field: Some("id".to_owned()),
            });
        };
        let current_file = find_current_template_file(operation_context, &template_id).await?;
        match current_file {
            Some(current_file) if current_file == template_file => {}
            Some(_) => {
                ImportWebhookTemplateOperation
                    .execute(
                        operation_context,
                        TemplateImportRequest {
                            file_text,
                            on_conflict: Some(ImportConflictChoice::Replace),
                        },
                    )
                    .await?;
            }
            None => create_seeded_template(operation_context, &template_id, template_file).await?,
        }
        Ok(template_id)
    }

    async fn export(operation_context: &OperationContext) -> Result<Vec<SeedItem>, OperationError> {
        let mut seed_items = Vec::new();
        for resolved_template in list_resolved_templates(operation_context).await? {
            let summary = &resolved_template.summary;
            if summary.source == TemplateSource::Builtin && !summary.is_modified {
                continue;
            }
            let (template_id, template_name) = (summary.id.clone(), summary.name.clone());
            let file_text = write_template_toml(&resolved_template.into_detail(0));
            let table: toml::Table = toml::from_str(&file_text)
                .map_err(|read_error| OperationError::Internal(read_error.to_string()))?;
            seed_items.push(SeedItem {
                item_key: template_id,
                item_name: template_name,
                table,
            });
        }
        Ok(seed_items)
    }

    /// Deletes custom templates the seed does not hold and puts edited built-ins back.
    async fn remove_unlisted(
        operation_context: &OperationContext,
        kept_item_keys: &[String],
    ) -> Result<(), OperationError> {
        let template_repository = &operation_context.webhook_template_repository;
        for stored_template in template_repository.list_templates().await? {
            if !kept_item_keys.contains(&stored_template.template_id) {
                template_repository
                    .delete_template(&stored_template.template_id)
                    .await?;
            }
        }
        Ok(())
    }
}

/// Moves `method`, `content_type`, `body` and `headers` under `request` when a file has them at
/// the top, as the demo exports them.
fn nest_request_keys(mut item_table: toml::Table) -> toml::Table {
    if item_table.contains_key("request") {
        return item_table;
    }
    let mut request_table = toml::Table::new();
    for request_key in REQUEST_KEYS {
        if let Some(request_value) = item_table.remove(request_key) {
            request_table.insert(request_key.to_owned(), request_value);
        }
    }
    if !request_table.is_empty() {
        item_table.insert("request".to_owned(), toml::Value::Table(request_table));
    }
    item_table
}

/// The template as a template file now; none when no template has the id.
async fn find_current_template_file(
    operation_context: &OperationContext,
    template_id: &str,
) -> Result<Option<TemplateFile>, OperationError> {
    let current_template = list_resolved_templates(operation_context)
        .await?
        .into_iter()
        .find(|resolved_template| resolved_template.summary.id == template_id);
    Ok(current_template
        .map(|current_template| write_template_toml(&current_template.into_detail(0)))
        .and_then(|current_text| parse_template_file(&current_text).ok()))
}

async fn create_seeded_template(
    operation_context: &OperationContext,
    template_id: &str,
    template_file: TemplateFile,
) -> Result<(), OperationError> {
    if find_builtin_template(template_id).is_some() || !template_id.starts_with("custom.") {
        return Err(OperationError::InvalidInput {
            message: format!(
                "{template_id} is not a built-in template; custom template ids start with custom."
            ),
            field: Some("id".to_owned()),
        });
    }
    check_draft_can_be_saved(
        operation_context,
        &template_file.draft,
        &template_file.events,
    )
    .await?;
    create_custom_template_with_id(
        operation_context,
        template_id.to_owned(),
        TemplateMetadata {
            name: template_file.name,
            description: "Added by a seed file.".to_owned(),
            events: template_file.events,
            required_variables: template_file.required_variables,
        },
        template_file.service,
        template_file.draft,
    )
    .await?;
    Ok(())
}

impl_seed_section_adapter!(WebhookTemplateSeedAdapter, WEBHOOK_TEMPLATES_SECTION);

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn moves_top_level_request_keys_under_request() {
        let demo_table: toml::Table =
            toml::from_str("id = \"custom.orders\"\nmethod = \"POST\"\nbody = \"{}\"\n")
                .unwrap_or_else(|error| panic!("a table: {error}"));

        let nested_table = nest_request_keys(demo_table);

        assert_eq!(nested_table["request"]["method"].as_str(), Some("POST"));
        assert_eq!(nested_table["request"]["body"].as_str(), Some("{}"));
        assert!(!nested_table.contains_key("method"));
    }
}
