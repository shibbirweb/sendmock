//! The templates that ship with SendMock, exported from the UI's fixtures
//! (`web/scripts/export-builtin-definitions.ts`), so the mock and the binary show one gallery.

use std::collections::BTreeMap;

use serde::Deserialize;

use super::endpoint_settings::WebhookHttpMethod;
use super::template_view::{
    ResolvedTemplate, TemplateCategory, TemplateDraft, TemplateSource, WebhookTemplateSummary,
};

const CATALOGUE_JSON: &str = include_str!("../../builtin/webhook-template-catalogue.json");
const REQUEST_SHAPES_JSON: &str = include_str!("../../builtin/webhook-templates.json");
pub const NATIVE_TEMPLATE_ID: &str = "native";

#[derive(Deserialize)]
struct CatalogueEntry {
    id: String,
    name: String,
    service: String,
    category: TemplateCategory,
    events: Vec<String>,
    description: String,
    required_variables: Vec<String>,
}

#[derive(Deserialize)]
struct RequestShape {
    method: WebhookHttpMethod,
    content_type: String,
    header_templates: BTreeMap<String, String>,
    body_template: String,
    doc_url: Option<String>,
    verified_on: Option<String>,
}

/// Every built-in template, in gallery order, as shipped.
pub fn list_builtin_templates() -> Vec<ResolvedTemplate> {
    let catalogue: Vec<CatalogueEntry> = serde_json::from_str(CATALOGUE_JSON).unwrap_or_default();
    let mut request_shapes: BTreeMap<String, RequestShape> =
        serde_json::from_str(REQUEST_SHAPES_JSON).unwrap_or_default();
    catalogue
        .into_iter()
        .filter_map(|catalogue_entry| {
            let request_shape = request_shapes.remove(&catalogue_entry.id)?;
            Some(ResolvedTemplate {
                summary: WebhookTemplateSummary {
                    id: catalogue_entry.id,
                    name: catalogue_entry.name,
                    service: catalogue_entry.service,
                    category: catalogue_entry.category,
                    source: TemplateSource::Builtin,
                    events: catalogue_entry.events,
                    description: catalogue_entry.description,
                    required_variables: catalogue_entry.required_variables,
                    revision: 1,
                    is_modified: false,
                },
                draft: TemplateDraft {
                    method: request_shape.method,
                    content_type: request_shape.content_type,
                    header_templates: request_shape.header_templates,
                    body_template: request_shape.body_template,
                },
                doc_url: request_shape.doc_url,
                verified_on: request_shape.verified_on,
            })
        })
        .collect()
}

pub fn find_builtin_template(template_id: &str) -> Option<ResolvedTemplate> {
    list_builtin_templates()
        .into_iter()
        .find(|builtin_template| builtin_template.summary.id == template_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_catalogue_entry_has_a_request_shape() {
        let builtin_templates = list_builtin_templates();

        assert_eq!(builtin_templates.len(), 18);
        assert_eq!(builtin_templates[0].summary.id, NATIVE_TEMPLATE_ID);
    }
}
