use sendmock_store::EmailRecord;

use super::email_access::find_email_or_not_found;
use super::email_detail::EmailDetail;
use super::email_inputs::{EmailListQuery, EmailReference, LatestEmailQuery};
use super::email_search_query::build_email_list_filter;
use super::email_summary::EmailSummary;
use super::email_timeline_entry::EmailTimelineEntry;
use super::list_unsubscribe_report::{ListUnsubscribeReport, check_list_unsubscribe};
use super::mime_part::MimePart;
use crate::{
    Operation, OperationContext, OperationDefinition, OperationError, OperationSelector, PageOf,
};

const DEFAULT_PAGE_SIZE: u32 = 50;
const MAXIMUM_PAGE_SIZE: u32 = 500;

fn read_only_get(
    operation_id: &'static str,
    path: &'static str,
    summary: &'static str,
    cli_usage: &'static str,
    mcp_tool: &'static str,
) -> OperationDefinition {
    OperationDefinition {
        operation_id,
        path,
        summary,
        is_read_only: true,
        cli_usage,
        mcp_tool,
        ..OperationDefinition::DEFAULTS
    }
}

pub struct ListEmailsOperation;

impl Operation for ListEmailsOperation {
    type Input = EmailListQuery;
    type Output = PageOf<EmailSummary>;

    fn definition(&self) -> OperationDefinition {
        read_only_get(
            "getEmails",
            "/api/v1/emails",
            "Stored emails, newest first, with search and filters.",
            "sendmock email list",
            "sendmock_email_list",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailListQuery,
    ) -> Result<PageOf<EmailSummary>, OperationError> {
        let page_size = input
            .limit
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAXIMUM_PAGE_SIZE);
        let page = operation_context
            .email_repository
            .list_emails(
                build_email_list_filter(&input),
                input.cursor.clone(),
                page_size,
            )
            .await?;
        Ok(PageOf {
            items: page.emails.iter().map(EmailSummary::from).collect(),
            next_cursor: page.next_cursor,
            total_count: page.total_count,
        })
    }
}

pub struct GetEmailOperation;

impl Operation for GetEmailOperation {
    type Input = EmailReference;
    type Output = EmailDetail;

    fn definition(&self) -> OperationDefinition {
        read_only_get(
            "getEmailsByEmailId",
            "/api/v1/emails/{emailId}",
            "One email with bodies, headers, attachments and extracted codes.",
            "sendmock email show <emailId>",
            "sendmock_email_get",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailReference,
    ) -> Result<EmailDetail, OperationError> {
        Ok(EmailDetail::from(
            &find_email_or_not_found(operation_context, &input.email_id).await?,
        ))
    }
}

pub struct GetLatestEmailOperation;

impl Operation for GetLatestEmailOperation {
    type Input = LatestEmailQuery;
    type Output = EmailDetail;

    fn definition(&self) -> OperationDefinition {
        read_only_get(
            "getEmailsLatest",
            "/api/v1/emails/latest",
            "The newest email to a recipient.",
            "sendmock email latest --to <address>",
            "sendmock_email_latest",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: LatestEmailQuery,
    ) -> Result<EmailDetail, OperationError> {
        let filter = sendmock_store::EmailListFilter {
            to_contains: Some(input.to.clone()),
            subject_contains: input.subject.clone(),
            ..sendmock_store::EmailListFilter::default()
        };
        let page = operation_context
            .email_repository
            .list_emails(filter, None, 1)
            .await?;
        let newest_email: Option<&EmailRecord> = page.emails.first();
        newest_email
            .map(EmailDetail::from)
            .ok_or_else(|| OperationError::NotFound {
                message: format!("No email to {} yet", input.to),
            })
    }
}

pub struct GetEmailTimelineOperation;

impl Operation for GetEmailTimelineOperation {
    type Input = EmailReference;
    type Output = Vec<EmailTimelineEntry>;

    fn definition(&self) -> OperationDefinition {
        read_only_get(
            "getEmailsByEmailIdTimeline",
            "/api/v1/emails/{emailId}/timeline",
            "Delivery events: received, delivered, opened, bounced.",
            "sendmock email timeline <emailId>",
            "sendmock_email_timeline",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailReference,
    ) -> Result<Vec<EmailTimelineEntry>, OperationError> {
        let timeline = operation_context
            .email_repository
            .list_timeline(&input.email_id)
            .await?;
        Ok(timeline.into_iter().map(EmailTimelineEntry::from).collect())
    }
}

pub struct GetEmailMimeOperation;

impl Operation for GetEmailMimeOperation {
    type Input = EmailReference;
    type Output = MimePart;

    fn definition(&self) -> OperationDefinition {
        read_only_get(
            "getEmailsByEmailIdMime",
            "/api/v1/emails/{emailId}/mime",
            "The MIME tree of the message.",
            "sendmock email mime <emailId>",
            "sendmock_email_mime",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailReference,
    ) -> Result<MimePart, OperationError> {
        let email = find_email_or_not_found(operation_context, &input.email_id).await?;
        serde_json::from_str(&email.mime_tree_json)
            .map_err(|parse_error| OperationError::Internal(parse_error.to_string()))
    }
}

pub struct CheckListUnsubscribeOperation;

impl Operation for CheckListUnsubscribeOperation {
    type Input = EmailReference;
    type Output = ListUnsubscribeReport;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            selector: Some(OperationSelector {
                input_name: "kind",
                value: "unsubscribe",
            }),
            ..read_only_get(
                "getEmailsByEmailIdListUnsubscribe",
                "/api/v1/emails/{emailId}/list-unsubscribe",
                "List-Unsubscribe and one-click unsubscribe checks.",
                "sendmock email check <emailId> unsubscribe",
                "sendmock_email_check",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailReference,
    ) -> Result<ListUnsubscribeReport, OperationError> {
        let email = find_email_or_not_found(operation_context, &input.email_id).await?;
        Ok(check_list_unsubscribe(&email.headers))
    }
}
