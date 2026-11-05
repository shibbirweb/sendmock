use schemars::JsonSchema;
use sendmock_mail::check_html_compatibility;
use serde::Serialize;

use super::email_access::find_email_or_not_found;
use super::email_inputs::EmailReference;
use crate::{
    HttpMethod, Operation, OperationContext, OperationDefinition, OperationError, OperationSelector,
};

/// One client's support for the email's HTML.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct HtmlClientSupport {
    pub client: String,
    pub support_percent: u8,
}

/// A feature some client does not fully support, with the first line using it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct HtmlCheckWarning {
    pub feature: String,
    pub support_percent: u8,
    #[schemars(required, schema_with = "crate::nullable_schema::<u32>")]
    pub line: Option<u32>,
    pub note: String,
}

/// How email clients render the HTML (EM-13.1), from caniemail's support data.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct HtmlCheckReport {
    pub overall_support_percent: u8,
    pub clients: Vec<HtmlClientSupport>,
    pub warnings: Vec<HtmlCheckWarning>,
}

pub struct CheckEmailHtmlOperation;

impl Operation for CheckEmailHtmlOperation {
    type Input = EmailReference;
    type Output = HtmlCheckReport;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getEmailsByEmailIdHtmlCheck",
            method: HttpMethod::Get,
            path: "/api/v1/emails/{emailId}/html-check",
            summary: "Each email client's support for the HTML and CSS the email uses.",
            cli_usage: "sendmock email check <emailId> html",
            mcp_tool: "sendmock_email_check",
            is_read_only: true,
            selector: Some(OperationSelector::by_value("kind", "html")),
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailReference,
    ) -> Result<HtmlCheckReport, OperationError> {
        let email = find_email_or_not_found(operation_context, &input.email_id).await?;
        let report = check_html_compatibility(email.html_body.as_deref().unwrap_or_default());
        Ok(HtmlCheckReport {
            overall_support_percent: report.overall_support_percent,
            clients: report
                .clients
                .into_iter()
                .map(|client| HtmlClientSupport {
                    client: client.client,
                    support_percent: client.support_percent,
                })
                .collect(),
            warnings: report
                .warnings
                .into_iter()
                .map(|warning| HtmlCheckWarning {
                    feature: warning.feature,
                    support_percent: warning.support_percent,
                    line: warning.line,
                    note: warning.note,
                })
                .collect(),
        })
    }
}
