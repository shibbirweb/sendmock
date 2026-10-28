use std::time::Duration;

use sendmock_core::{format_rfc3339, parse_rfc3339};
use sendmock_store::{EmailListFilter, EmailRecord};

use super::email_access::{read_wait_duration, wait_for_newest_email};
use super::email_detail::EmailDetail;
use super::email_inputs::{EmailWaitQuery, LinksQuery, RecipientLookupQuery};
use super::lookups::{LinksLookup, OtpLookup};
use crate::{Operation, OperationContext, OperationDefinition, OperationError};

const DEFAULT_WAIT: Duration = Duration::from_secs(30);
const DEFAULT_SINCE_MS: i64 = 30_000;
/// Recent emails to a recipient looked through for one that has a code or a link.
const RECENT_EMAILS_SEARCHED: u32 = 20;
const WAIT_POLL_INTERVAL: Duration = Duration::from_millis(200);

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
        cli_flag_names: &[("timeout", "wait")],
        ..OperationDefinition::DEFAULTS
    }
}

/// The newest email to the recipient that `has_value` accepts; waits up to `wait_duration`
/// for one, and answers at once when it is zero.
async fn find_newest_with(
    operation_context: &OperationContext,
    recipient: &str,
    wait_duration: Duration,
    has_value: fn(&EmailRecord) -> bool,
) -> Result<Option<EmailRecord>, OperationError> {
    let wait_deadline = tokio::time::Instant::now() + wait_duration;
    let filter = EmailListFilter {
        to_contains: Some(recipient.to_owned()),
        ..EmailListFilter::default()
    };
    loop {
        let page = operation_context
            .email_repository
            .list_emails(filter.clone(), None, RECENT_EMAILS_SEARCHED)
            .await?;
        if let Some(matching_email) = page.emails.into_iter().find(has_value) {
            return Ok(Some(matching_email));
        }
        if tokio::time::Instant::now() >= wait_deadline {
            return Ok(None);
        }
        tokio::time::sleep(WAIT_POLL_INTERVAL).await;
    }
}

pub struct GetOtpOperation;

impl Operation for GetOtpOperation {
    type Input = RecipientLookupQuery;
    type Output = OtpLookup;

    fn definition(&self) -> OperationDefinition {
        read_only_get(
            "getOtp",
            "/api/v1/otp",
            "The latest one-time code sent to a recipient.",
            "sendmock otp --to <recipient>",
            "sendmock_otp_get",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: RecipientLookupQuery,
    ) -> Result<OtpLookup, OperationError> {
        let channel = input.channel.clone().unwrap_or_else(|| "email".to_owned());
        if channel != "email" {
            return Err(OperationError::NotFound {
                message: format!("No {channel} codes yet: SendMock catches email so far"),
            });
        }
        let wait_duration = read_wait_duration(input.timeout.as_deref(), Duration::ZERO)?;
        let email_with_code =
            find_newest_with(operation_context, &input.to, wait_duration, |email| {
                !email.otp_codes.is_empty()
            })
            .await?;
        let email_with_code =
            email_with_code.ok_or_else(|| missing_value_error(&input, "code", wait_duration))?;
        Ok(OtpLookup {
            to: input.to,
            channel,
            code: email_with_code
                .otp_codes
                .first()
                .cloned()
                .unwrap_or_default(),
            source_id: email_with_code.email_id.clone(),
            received_at: format_rfc3339(email_with_code.received_at_unix_ms),
        })
    }
}

fn missing_value_error(
    input: &RecipientLookupQuery,
    value_name: &str,
    wait_duration: Duration,
) -> OperationError {
    if wait_duration.is_zero() {
        OperationError::NotFound {
            message: format!("No {value_name} sent to {} yet", input.to),
        }
    } else {
        OperationError::Timeout {
            message: format!(
                "No {value_name} sent to {} within {} ms",
                input.to,
                wait_duration.as_millis()
            ),
        }
    }
}

pub struct GetLinksOperation;

impl Operation for GetLinksOperation {
    type Input = LinksQuery;
    type Output = LinksLookup;

    fn definition(&self) -> OperationDefinition {
        read_only_get(
            "getLinks",
            "/api/v1/links",
            "The links of the latest email to a recipient.",
            "sendmock links --to <recipient>",
            "sendmock_links_get",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: LinksQuery,
    ) -> Result<LinksLookup, OperationError> {
        let wait_duration = read_wait_duration(input.timeout.as_deref(), Duration::ZERO)?;
        let email_with_links =
            find_newest_with(operation_context, &input.to, wait_duration, |email| {
                !email.links.is_empty()
            })
            .await?;
        let lookup_query = RecipientLookupQuery {
            to: input.to.clone(),
            channel: None,
            timeout: input.timeout.clone(),
        };
        let email_with_links = email_with_links
            .ok_or_else(|| missing_value_error(&lookup_query, "link", wait_duration))?;
        Ok(LinksLookup {
            to: input.to,
            email_id: email_with_links.email_id.clone(),
            links: email_with_links.links.clone(),
            received_at: format_rfc3339(email_with_links.received_at_unix_ms),
        })
    }
}

pub struct WaitForEmailOperation;

impl Operation for WaitForEmailOperation {
    type Input = EmailWaitQuery;
    type Output = EmailDetail;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            cli_flag_names: &[],
            ..read_only_get(
                "getWaitEmail",
                "/api/v1/wait/email",
                "Wait until a matching email arrives; 408 on timeout.",
                "sendmock email wait",
                "sendmock_email_wait",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailWaitQuery,
    ) -> Result<EmailDetail, OperationError> {
        let received_after_unix_ms = match input.since.as_deref() {
            Some(since_text) => parse_rfc3339(since_text).ok_or_else(|| OperationError::InvalidInput {
                message: format!("`since` must be an RFC 3339 time, such as 2026-10-29T10:00:00Z, not {since_text}"),
                field: Some("since".to_owned()),
            })?,
            None => operation_context.clock.now_unix_ms() - DEFAULT_SINCE_MS,
        };
        let filter = EmailListFilter {
            to_contains: input.to.clone(),
            subject_contains: input.subject.clone(),
            received_after_unix_ms: Some(received_after_unix_ms - 1),
            ..EmailListFilter::default()
        };
        let wait_duration = read_wait_duration(input.timeout.as_deref(), DEFAULT_WAIT)?;
        match wait_for_newest_email(operation_context, filter, wait_duration).await? {
            Some(matching_email) => Ok(EmailDetail::from(&matching_email)),
            None => Err(OperationError::Timeout {
                message: format!(
                    "No matching email arrived within {} ms",
                    wait_duration.as_millis()
                ),
            }),
        }
    }
}
