use sendmock_store::{VerificationFilter, VerificationRecord};

use super::verification_outcomes::{expire_overdue_verifications, finish_verification};
use super::verify_inputs::{
    ForcedVerificationState, VerificationForceInput, VerificationListInput, VerificationReference,
};
use super::verify_views::{Verification, VerificationDetail, VerificationTimelineEntry};
use crate::{
    CliArgument, HttpMethod, Operation, OperationContext, OperationDefinition, OperationError,
    PageOf,
};

const DEFAULT_PAGE_SIZE: u32 = 50;
const MAXIMUM_PAGE_SIZE: u32 = 200;

pub async fn find_verification_or_not_found(
    operation_context: &OperationContext,
    verification_sid: &str,
) -> Result<VerificationRecord, OperationError> {
    operation_context
        .verification_repository
        .find_verification(verification_sid)
        .await?
        .ok_or_else(|| OperationError::NotFound {
            message: format!("No verification with SID {verification_sid}"),
        })
}

pub async fn load_verification_detail(
    operation_context: &OperationContext,
    verification: VerificationRecord,
) -> Result<VerificationDetail, OperationError> {
    let timeline = operation_context
        .verification_repository
        .list_timeline(&verification.verification_sid)
        .await?;
    Ok(VerificationDetail {
        verification: Verification::from(&verification),
        timeline: timeline
            .into_iter()
            .map(VerificationTimelineEntry::from)
            .collect(),
    })
}

pub struct ListVerificationsOperation;

impl Operation for ListVerificationsOperation {
    type Input = VerificationListInput;
    type Output = PageOf<Verification>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getVerify",
            method: HttpMethod::Get,
            path: "/api/v1/verify",
            summary: "Verifications your app started, newest first.",
            is_read_only: true,
            cli_usage: "sendmock verify list",
            mcp_tool: "sendmock_verify_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: VerificationListInput,
    ) -> Result<PageOf<Verification>, OperationError> {
        expire_overdue_verifications(operation_context).await?;
        let filter = VerificationFilter {
            statuses: input
                .status
                .map(|statuses| {
                    statuses
                        .split(',')
                        .map(|status| status.trim().to_owned())
                        .filter(|status| !status.is_empty())
                        .collect()
                })
                .unwrap_or_default(),
            to_text: input.to,
            channel: input.channel,
        };
        let page_size = input
            .limit
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAXIMUM_PAGE_SIZE);
        let page = operation_context
            .verification_repository
            .list_verifications(filter, input.cursor, page_size)
            .await?;
        Ok(PageOf {
            items: page.verifications.iter().map(Verification::from).collect(),
            next_cursor: page.next_cursor,
            total_count: page.total_count,
        })
    }
}

pub struct GetVerificationOperation;

impl Operation for GetVerificationOperation {
    type Input = VerificationReference;
    type Output = VerificationDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getVerifyByVerificationSid",
            method: HttpMethod::Get,
            path: "/api/v1/verify/{verificationSid}",
            summary: "One verification with its code, attempts and timeline.",
            is_read_only: true,
            cli_usage: "sendmock verify show <verificationSid>",
            mcp_tool: "sendmock_verify_get",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: VerificationReference,
    ) -> Result<VerificationDetail, OperationError> {
        expire_overdue_verifications(operation_context).await?;
        let verification =
            find_verification_or_not_found(operation_context, &input.verification_sid).await?;
        load_verification_detail(operation_context, verification).await
    }
}

pub struct ForceVerificationOperation;

impl Operation for ForceVerificationOperation {
    type Input = VerificationForceInput;
    type Output = VerificationDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postVerifyByVerificationSidForce",
            method: HttpMethod::Post,
            path: "/api/v1/verify/{verificationSid}/force",
            summary: "Force an outcome: approved, expired, canceled or max attempts.",
            cli_usage: "sendmock verify force <verificationSid> <status>",
            cli_arguments: &[CliArgument {
                placeholder: "status",
                input_name: "state",
                reads_file: false,
            }],
            mcp_tool: "sendmock_verify_force",
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Changes the state at once, whatever it was, so apps can test every outcome.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: VerificationForceInput,
    ) -> Result<VerificationDetail, OperationError> {
        let verification =
            find_verification_or_not_found(operation_context, &input.verification_sid).await?;
        let final_status = match input.state {
            ForcedVerificationState::Approved => "approved",
            ForcedVerificationState::Canceled => "canceled",
            ForcedVerificationState::Expired => "expired",
            ForcedVerificationState::MaxAttempts => "max_attempts_reached",
        };
        let finished = finish_verification(
            operation_context,
            verification,
            final_status,
            "Forced from SendMock",
        )
        .await?;
        load_verification_detail(operation_context, finished).await
    }
}
