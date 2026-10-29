/// A custom template, or an edited built-in one, as stored; the operations layer owns the
/// JSON documents and the rules.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WebhookTemplateRecord {
    pub template_id: String,
    /// `custom`, or `builtin` for an edited built-in template.
    pub source: String,
    pub name: String,
    pub service: String,
    pub description: String,
    /// The event types, as a JSON list.
    pub events_json: String,
    /// The variable names an endpoint must define, as a JSON list.
    pub required_variables_json: String,
    pub method: String,
    pub content_type: String,
    /// Header name to template, as a JSON object.
    pub header_templates_json: String,
    pub body_template: String,
    pub revision: u32,
    pub updated_at_unix_ms: i64,
}

/// One saved version of a template, as the JSON the operations layer writes.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WebhookTemplateRevisionRecord {
    pub template_id: String,
    pub revision: u32,
    pub saved_at_unix_ms: i64,
    pub template_json: String,
}
