use schemars::JsonSchema;
use serde::Deserialize;

use super::email_access::find_email_or_not_found;
use super::email_release::release_email;
use crate::{
    HttpMethod, NoContent, Operation, OperationContext, OperationDefinition, OperationError,
    SuccessStatus,
};

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EmailReleaseInput {
    pub email_id: String,
    /// Who receives it on the real SMTP server; empty sends to the original recipients. Every
    /// address must match the release allowlist.
    #[serde(default)]
    pub to: Option<Vec<String>>,
}

pub struct ReleaseEmailOperation;

impl Operation for ReleaseEmailOperation {
    type Input = EmailReleaseInput;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postEmailsByEmailIdRelease",
            method: HttpMethod::Post,
            path: "/api/v1/emails/{emailId}/release",
            summary: "Send the email on through the allowlisted relay.",
            cli_usage: "sendmock email release <emailId>",
            mcp_tool: "sendmock_email_release",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Off until a relay and an allowlist are set (EM-14.1); recipients off the allowlist are
    /// refused (EM-14.2); a relay that refuses the message is a `502` after the timeline
    /// records it (EM-14.4).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailReleaseInput,
    ) -> Result<NoContent, OperationError> {
        let stored_email = find_email_or_not_found(operation_context, &input.email_id).await?;
        let recipients = input
            .to
            .filter(|chosen_recipients| !chosen_recipients.is_empty())
            .unwrap_or_else(|| stored_email.envelope_to.clone());
        if recipients.is_empty() {
            return Err(OperationError::InvalidInput {
                message: "No recipients to release to".to_owned(),
                field: Some("to".to_owned()),
            });
        }
        let release_result =
            release_email(operation_context, &stored_email, &recipients, "hand").await?;
        if release_result.is_sent {
            Ok(NoContent)
        } else {
            Err(OperationError::Upstream {
                code: "relay_failed",
                message: format!(
                    "The relay did not take the message: {}",
                    release_result.relay_reply
                ),
            })
        }
    }
}
