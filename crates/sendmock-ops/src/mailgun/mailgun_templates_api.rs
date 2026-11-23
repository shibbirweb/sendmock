use sendmock_store::EmailLocalTemplateRecord;
use serde_json::{Value, json};

use crate::providers::{ProviderHttpResponse, answer_json};
use crate::{OperationContext, OperationError};

/// When a local template's one version says it was made: Mailgun writes RFC 1123 dates, and
/// SendMock keeps no date for a template, so every version reads as made at the epoch.
const TEMPLATE_CREATED_AT: &str = "Thu, 01 Jan 1970 00:00:00 UTC";

/// One local template as Mailgun answers a template with its active version: the HTML body
/// (or the text when there is none) as the version's template, the subject as its header.
fn describe_template(template_record: &EmailLocalTemplateRecord) -> Value {
    let version_body = template_record
        .html_body
        .clone()
        .or_else(|| template_record.text_body.clone())
        .unwrap_or_default();
    json!({
        "template": {
            "createdAt": TEMPLATE_CREATED_AT,
            "description": "",
            "name": template_record.template_id,
            "id": template_record.template_id,
            "version": {
                "createdAt": TEMPLATE_CREATED_AT,
                "engine": "handlebars",
                "tag": "initial",
                "comment": "",
                "template": version_body,
                "active": true,
                "headers": { "Subject": template_record.subject },
            },
        },
    })
}

/// `GET /v3/{domain}/templates/{name}`, with or without `active=yes`: a local email template
/// in Mailgun's shape, or Mailgun's 404 for a name with none (EM-26.3).
pub async fn answer_template(
    operation_context: &OperationContext,
    template_name: &str,
) -> Result<ProviderHttpResponse, OperationError> {
    let template_record = operation_context
        .email_stores
        .local_templates
        .find_template(template_name)
        .await?;
    Ok(match template_record {
        Some(template_record) => answer_json(200, describe_template(&template_record)),
        None => answer_json(404, json!({ "message": "template not found" })),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: EM-26.3
    #[test]
    fn a_template_answers_its_html_as_the_active_version_with_the_subject_header() {
        let described = describe_template(&EmailLocalTemplateRecord {
            template_id: "welcome-email".to_owned(),
            subject: "Welcome".to_owned(),
            text_body: Some("Hi".to_owned()),
            html_body: Some("<p>Hi</p>".to_owned()),
        });

        assert_eq!(described["template"]["name"], "welcome-email");
        assert_eq!(described["template"]["version"]["template"], "<p>Hi</p>");
        assert_eq!(described["template"]["version"]["active"], true);
        assert_eq!(
            described["template"]["version"]["headers"]["Subject"],
            "Welcome"
        );
    }
}
