use std::collections::BTreeMap;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

use super::endpoint_settings::WebhookHttpMethod;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "kebab-case")]
pub enum TemplateCategory {
    EmailProvider,
    SmsProvider,
    Chat,
    Automation,
    Generic,
    Custom,
}

/// `builtin` ships with SendMock, `custom` is yours, `file` comes from `--templates-dir`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum TemplateSource {
    Builtin,
    Custom,
    File,
}

/// A template in the gallery.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct WebhookTemplateSummary {
    pub id: String,
    /// The template's name.
    pub name: String,
    pub service: String,
    pub category: TemplateCategory,
    pub source: TemplateSource,
    /// The event types the template is made for.
    pub events: Vec<String>,
    /// What the template sends and where.
    pub description: String,
    /// Variables an endpoint must define to use it.
    pub required_variables: Vec<String>,
    pub revision: u32,
    /// A built-in template the user edited; Reset to default restores it (WH-09.8).
    pub is_modified: bool,
}

/// The editable part of a template: the request it renders.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct TemplateDraft {
    /// The HTTP method.
    pub method: WebhookHttpMethod,
    /// The body's content type.
    pub content_type: String,
    /// Header name to a template, e.g. "X-Twilio-Signature": "{{ twilio_signature(...) }}".
    pub header_templates: BTreeMap<String, String>,
    /// The body, a template over the event, its data and the variables.
    pub body_template: String,
}

/// `GET /api/v1/webhooks/templates/{templateId}` (WH-08.4).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct WebhookTemplateDetail {
    #[serde(flatten)]
    pub summary: WebhookTemplateSummary,
    #[serde(flatten)]
    pub draft: TemplateDraft,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub doc_url: Option<String>,
    /// "2026-09-30": when a provider template was last checked against the docs.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub verified_on: Option<String>,
    pub used_by_endpoint_count: u32,
}

/// The details only custom templates can change (WH-09.9).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct TemplateMetadata {
    pub name: String,
    pub description: String,
    pub events: Vec<String>,
    pub required_variables: Vec<String>,
}

/// A template as one revision keeps it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct RevisedTemplate {
    #[serde(flatten)]
    pub draft: TemplateDraft,
    #[serde(flatten)]
    pub metadata: TemplateMetadata,
}

/// One saved version of a template (WH-09.5).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct TemplateRevision {
    pub revision: u32,
    pub saved_at: String,
    pub template: RevisedTemplate,
}

/// A template with its request shape and provider links, built-in or stored.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedTemplate {
    pub summary: WebhookTemplateSummary,
    pub draft: TemplateDraft,
    pub doc_url: Option<String>,
    pub verified_on: Option<String>,
}

impl ResolvedTemplate {
    pub fn metadata(&self) -> TemplateMetadata {
        TemplateMetadata {
            name: self.summary.name.clone(),
            description: self.summary.description.clone(),
            events: self.summary.events.clone(),
            required_variables: self.summary.required_variables.clone(),
        }
    }

    pub fn into_detail(self, used_by_endpoint_count: u32) -> WebhookTemplateDetail {
        WebhookTemplateDetail {
            summary: self.summary,
            draft: self.draft,
            doc_url: self.doc_url,
            verified_on: self.verified_on,
            used_by_endpoint_count,
        }
    }
}
