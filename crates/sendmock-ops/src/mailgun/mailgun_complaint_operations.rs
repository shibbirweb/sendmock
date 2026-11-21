use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use serde::{Deserialize, Serialize};

use crate::{
    HttpMethod, NoContent, Operation, OperationContext, OperationDefinition, OperationError,
    SuccessStatus,
};

/// One address on a Mailgun domain's complaints table.
#[derive(Debug, Clone, PartialEq, Serialize, JsonSchema)]
pub struct MailgunComplaint {
    /// The sending domain, as in `/v3/{domain}/messages`.
    pub domain: String,
    pub address: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct MailgunComplaintFilter {
    /// Only this sending domain's complaints; every domain's when left out.
    #[serde(default)]
    pub domain: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct MailgunComplaintDomain {
    /// The sending domain whose complaints are cleared.
    pub domain: String,
}

pub struct ListMailgunComplaintsOperation;

impl Operation for ListMailgunComplaintsOperation {
    type Input = MailgunComplaintFilter;
    type Output = Vec<MailgunComplaint>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getMailgunComplaints",
            method: HttpMethod::Get,
            path: "/api/v1/mailgun/complaints",
            summary: "Addresses on each Mailgun domain's complaints table.",
            is_read_only: true,
            cli_usage: "sendmock email mailgun complaints list",
            mcp_tool: "sendmock_email_mailgun_complaint_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: MailgunComplaintFilter,
    ) -> Result<Vec<MailgunComplaint>, OperationError> {
        let stored_complaints = operation_context
            .email_stores
            .mailgun_complaints
            .list_complaints(input.domain.as_deref())
            .await?;
        Ok(stored_complaints
            .into_iter()
            .map(|stored_complaint| MailgunComplaint {
                domain: stored_complaint.domain,
                address: stored_complaint.address,
                created_at: format_rfc3339(stored_complaint.created_at_unix_ms),
            })
            .collect())
    }
}

pub struct ClearMailgunComplaintsOperation;

impl Operation for ClearMailgunComplaintsOperation {
    type Input = MailgunComplaintDomain;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteMailgunComplaintsByDomain",
            method: HttpMethod::Delete,
            path: "/api/v1/mailgun/complaints/{domain}",
            summary: "Clear a Mailgun domain's complaints, so its addresses get mail again.",
            is_destructive: true,
            cli_usage: "sendmock email mailgun complaints clear <domain>",
            mcp_tool: "sendmock_email_mailgun_complaint_clear",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: MailgunComplaintDomain,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .email_stores
            .mailgun_complaints
            .delete_domain_complaints(&input.domain)
            .await?;
        Ok(NoContent)
    }
}
