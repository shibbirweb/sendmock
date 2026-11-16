use super::verification_operations::build_verification_filter;
use super::verify_inputs::{VerificationFilterQuery, VerificationReference};
use crate::events::publish_traffic_cleared;
use crate::{
    HttpMethod, NoContent, Operation, OperationContext, OperationDefinition, OperationError,
    SuccessStatus,
};

pub struct DeleteVerificationOperation;

impl Operation for DeleteVerificationOperation {
    type Input = VerificationReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteVerifyByVerificationSid",
            method: HttpMethod::Delete,
            path: "/api/v1/verify/{verificationSid}",
            summary: "Delete one verification with its check attempts.",
            is_destructive: true,
            cli_usage: "sendmock verify delete <verificationSid>",
            mcp_tool: "sendmock_verify_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Deleting a verification that is already gone also succeeds, so retries are safe.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: VerificationReference,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .verification_repository
            .delete_verification(&input.verification_sid)
            .await?;
        Ok(NoContent)
    }
}

pub struct DeleteVerificationsOperation;

impl Operation for DeleteVerificationsOperation {
    type Input = VerificationFilterQuery;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deleteVerify",
            method: HttpMethod::Delete,
            path: "/api/v1/verify",
            summary: "Delete every verification, or those the filters match.",
            is_destructive: true,
            cli_usage: "sendmock verify delete-all --yes",
            mcp_tool: "sendmock_verify_delete_all",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: VerificationFilterQuery,
    ) -> Result<NoContent, OperationError> {
        let project_key = input.project.clone();
        let deleted_count = operation_context
            .verification_repository
            .delete_matching_verifications(build_verification_filter(input))
            .await?;
        publish_traffic_cleared(
            operation_context,
            &["verification"],
            project_key.as_deref(),
            deleted_count,
        );
        Ok(NoContent)
    }
}
