/// A local stand-in for a provider's email template, keyed by the provider's template id.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmailLocalTemplateRecord {
    pub template_id: String,
    pub subject: String,
    pub text_body: Option<String>,
    pub html_body: Option<String>,
}
