use schemars::JsonSchema;
use serde::Deserialize;

use super::template_view::TemplateDraft;

/// A template by id, as the path names it.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct WebhookTemplateReference {
    /// The template's id, from `GET /api/v1/webhooks/templates`.
    pub template_id: String,
}

/// Body of `POST /api/v1/webhooks/templates` (a new blank custom template).
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct TemplateCreateRequest {
    /// The name of the new blank custom template.
    pub name: String,
}

/// `PATCH /api/v1/webhooks/templates/{templateId}`: the request shape, and for custom
/// templates their details.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct TemplateUpdate {
    /// The template's id, from `GET /api/v1/webhooks/templates`.
    pub template_id: String,
    #[serde(flatten)]
    pub draft: TemplateDraft,
    pub name: Option<String>,
    pub description: Option<String>,
    pub events: Option<Vec<String>>,
    pub required_variables: Option<Vec<String>>,
}

/// `DELETE /api/v1/webhooks/templates/{templateId}`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct TemplateDeleteRequest {
    /// The template's id, from `GET /api/v1/webhooks/templates`.
    pub template_id: String,
    /// detach: endpoints that use it keep their own copy of it instead of failing.
    pub endpoints: Option<String>,
}

/// `POST /api/v1/webhooks/templates/{templateId}/clone`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct TemplateCloneRequest {
    /// The template's id, from `GET /api/v1/webhooks/templates`.
    pub template_id: String,
    /// The name of the copy.
    pub name: String,
}

/// `POST /api/v1/webhooks/templates/{templateId}/revisions/{revision}/restore`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct TemplateRevisionReference {
    /// The template's id, from `GET /api/v1/webhooks/templates`.
    pub template_id: String,
    /// The revision number, from the template's revisions.
    pub revision: u32,
}

/// `POST /api/v1/webhooks/templates/{templateId}/render`; no message means the sample.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct TemplateRenderRequest {
    /// The template's id, from `GET /api/v1/webhooks/templates`.
    pub template_id: String,
    /// Render against this email; with no IDs the sample event is used.
    pub email_id: Option<String>,
    /// Render against this SMS.
    pub sms_id: Option<String>,
    /// A captured HTTP request, as the data of an `http.captured` event.
    pub http_request_id: Option<String>,
    /// Unsaved edits to preview instead of the stored template (WH-09.7).
    pub draft: Option<TemplateDraft>,
}
