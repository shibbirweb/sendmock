use schemars::JsonSchema;
use sendmock_store::EmailLocalTemplateRecord;
use serde::{Deserialize, Serialize};

use crate::{OperationError, PartialChanges};

/// A local stand-in for a provider's email template: a send that names its id gets this
/// subject and these bodies, rendered from the send's template data.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, JsonSchema)]
pub struct EmailTemplate {
    /// The provider's template id or name: SendGrid's `d-...`, Postmark's number or alias,
    /// Mailgun's template name.
    pub id: String,
    /// The subject, used when the send gives none; can use the template data.
    pub subject: String,
    /// The plain-text body; at least one of `text` and `html`.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub text: Option<String>,
    /// The HTML body.
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub html: Option<String>,
}

impl From<EmailLocalTemplateRecord> for EmailTemplate {
    fn from(template_record: EmailLocalTemplateRecord) -> Self {
        Self {
            id: template_record.template_id,
            subject: template_record.subject,
            text: template_record.text_body,
            html: template_record.html_body,
        }
    }
}

impl EmailTemplate {
    /// The template as stored, refused without an id or without any body.
    pub fn into_record(self) -> Result<EmailLocalTemplateRecord, OperationError> {
        let template_id = self.id.trim().to_owned();
        if template_id.is_empty() {
            return Err(OperationError::InvalidInput {
                message: "Enter the provider's template id or name".to_owned(),
                field: Some("id".to_owned()),
            });
        }
        let has_body = [&self.text, &self.html]
            .iter()
            .any(|body| body.as_deref().is_some_and(|text| !text.is_empty()));
        if !has_body {
            return Err(OperationError::InvalidInput {
                message: format!("The email template {template_id} needs a text or HTML body"),
                field: Some("text".to_owned()),
            });
        }
        Ok(EmailLocalTemplateRecord {
            template_id,
            subject: self.subject,
            text_body: self.text.filter(|text| !text.is_empty()),
            html_body: self.html.filter(|html| !html.is_empty()),
        })
    }
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EmailTemplateReference {
    /// The template's id, from `GET /api/v1/emails/templates`.
    pub template_id: String,
}

/// `PATCH /api/v1/emails/templates/{templateId}`: only the fields to change.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EmailTemplateUpdate {
    /// The template's id, from `GET /api/v1/emails/templates`.
    pub template_id: String,
    #[serde(flatten)]
    pub changes: PartialChanges<EmailTemplateChanges>,
}

/// What an update can change; the id is fixed.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct EmailTemplateChanges {
    pub subject: String,
    pub text: Option<String>,
    pub html: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: EM-26.2
    #[test]
    fn a_template_needs_an_id_and_a_body() {
        let template = |id: &str, text: Option<&str>| EmailTemplate {
            id: id.to_owned(),
            subject: "Welcome".to_owned(),
            text: text.map(str::to_owned),
            html: None,
        };

        assert!(template(" ", Some("Hi")).into_record().is_err());
        assert!(template("welcome", None).into_record().is_err());
        assert_eq!(
            template(" welcome ", Some("Hi"))
                .into_record()
                .map(|record| record.template_id)
                .ok(),
            Some("welcome".to_owned())
        );
    }
}
