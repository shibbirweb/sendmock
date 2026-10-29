use std::time::Duration;

use sendmock_core::parse_rfc3339;
use sendmock_store::SmsListFilter;

use super::sms_detail::{SmsMessageDetail, find_sms_or_not_found, load_sms_detail};
use super::sms_inputs::{SmsListInput, SmsMediaReference, SmsReference, WaitSmsInput};
use super::sms_views::{SmsMessage, SmsThread};
use crate::{
    AnswerKind, FileAnswer, HttpMethod, NoInput, Operation, OperationContext, OperationDefinition,
    OperationError, PageOf,
};

const DEFAULT_PAGE_SIZE: u32 = 50;
const MAXIMUM_PAGE_SIZE: u32 = 200;
const DEFAULT_WAIT: Duration = Duration::from_secs(10);
const MAXIMUM_WAIT: Duration = Duration::from_secs(60);
const DEFAULT_LOOKBACK_MS: i64 = 30_000;
const WAIT_POLL_INTERVAL: Duration = Duration::from_millis(100);

fn read_only_get(
    operation_id: &'static str,
    path: &'static str,
    summary: &'static str,
    cli_usage: &'static str,
    mcp_tool: &'static str,
) -> OperationDefinition {
    OperationDefinition {
        operation_id,
        method: HttpMethod::Get,
        path,
        summary,
        is_read_only: true,
        cli_usage,
        mcp_tool,
        ..OperationDefinition::DEFAULTS
    }
}

pub struct ListSmsOperation;

impl Operation for ListSmsOperation {
    type Input = SmsListInput;
    type Output = PageOf<SmsMessage>;

    fn definition(&self) -> OperationDefinition {
        read_only_get(
            "getSms",
            "/api/v1/sms",
            "SMS and WhatsApp messages, newest first, with filters.",
            "sendmock sms list",
            "sendmock_sms_list",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmsListInput,
    ) -> Result<PageOf<SmsMessage>, OperationError> {
        let filter = SmsListFilter {
            search_text: input.query,
            from_number: input.from,
            to_number: input.to,
            status: input.status,
            direction: input.direction,
            thread_id: input.thread_id,
            created_after_unix_ms: None,
        };
        let page_size = input
            .limit
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAXIMUM_PAGE_SIZE);
        let page = operation_context
            .sms_repository
            .list_messages(filter, input.cursor, page_size)
            .await?;
        Ok(PageOf {
            items: page.messages.iter().map(SmsMessage::from).collect(),
            next_cursor: page.next_cursor,
            total_count: page.total_count,
        })
    }
}

pub struct ListSmsThreadsOperation;

impl Operation for ListSmsThreadsOperation {
    type Input = NoInput;
    type Output = Vec<SmsThread>;

    fn definition(&self) -> OperationDefinition {
        read_only_get(
            "getSmsThreads",
            "/api/v1/sms/threads",
            "Conversations, one per contact and your number.",
            "sendmock sms threads",
            "sendmock_sms_threads",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        _input: NoInput,
    ) -> Result<Vec<SmsThread>, OperationError> {
        let threads = operation_context.sms_repository.list_threads().await?;
        Ok(threads.into_iter().map(SmsThread::from).collect())
    }
}

pub struct GetSmsOperation;

impl Operation for GetSmsOperation {
    type Input = SmsReference;
    type Output = SmsMessageDetail;

    fn definition(&self) -> OperationDefinition {
        read_only_get(
            "getSmsBySmsId",
            "/api/v1/sms/{smsId}",
            "One message with its status history and callbacks.",
            "sendmock sms show <smsId>",
            "sendmock_sms_get",
        )
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmsReference,
    ) -> Result<SmsMessageDetail, OperationError> {
        let sms = find_sms_or_not_found(operation_context, &input.sms_id).await?;
        load_sms_detail(operation_context, sms).await
    }
}

pub struct DownloadSmsMediaOperation;

impl Operation for DownloadSmsMediaOperation {
    type Input = SmsMediaReference;
    type Output = FileAnswer;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            answer_kind: AnswerKind::File {
                content_type: "*/*",
            },
            ..read_only_get(
                "getSmsBySmsIdMediaByMediaIndex",
                "/api/v1/sms/{smsId}/media/{mediaIndex}",
                "Download one media item of an MMS or WhatsApp message.",
                "sendmock sms media <smsId> <mediaIndex>",
                "sendmock://sms/{smsId}/media/{mediaIndex}",
            )
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: SmsMediaReference,
    ) -> Result<FileAnswer, OperationError> {
        let (content_type, filename, bytes) = operation_context
            .sms_repository
            .read_media_content(&input.sms_id, input.media_index)
            .await?
            .ok_or_else(|| OperationError::NotFound {
                message: format!("No media {} on SMS {}", input.media_index, input.sms_id),
            })?;
        Ok(FileAnswer {
            content_type,
            file_name: filename,
            bytes,
        })
    }
}

pub struct WaitForSmsOperation;

impl Operation for WaitForSmsOperation {
    type Input = WaitSmsInput;
    type Output = SmsMessageDetail;

    fn definition(&self) -> OperationDefinition {
        read_only_get(
            "getWaitSms",
            "/api/v1/wait/sms",
            "Wait until a matching SMS arrives; 408 on timeout.",
            "sendmock sms wait",
            "sendmock_sms_wait",
        )
    }

    /// Polls for the newest message to `to` (and from `from`) created after `since`, until the
    /// timeout (PL-03.1, PL-03.2).
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: WaitSmsInput,
    ) -> Result<SmsMessageDetail, OperationError> {
        let (wait_duration, since_unix_ms) = read_wait_window(operation_context, &input)?;
        let filter = SmsListFilter {
            to_number: input.to.map(|to_number| {
                sendmock_sms::PhoneNumber::parse(&to_number)
                    .normalized()
                    .to_owned()
            }),
            from_number: input.from.map(|from_number| {
                sendmock_sms::PhoneNumber::parse(&from_number)
                    .normalized()
                    .to_owned()
            }),
            created_after_unix_ms: Some(since_unix_ms),
            ..SmsListFilter::default()
        };
        let deadline = tokio::time::Instant::now() + wait_duration;
        loop {
            let page = operation_context
                .sms_repository
                .list_messages(filter.clone(), None, 1)
                .await?;
            if let Some(newest_sms) = page.messages.into_iter().next() {
                return load_sms_detail(operation_context, newest_sms).await;
            }
            if tokio::time::Instant::now() >= deadline {
                return Err(OperationError::Timeout {
                    message: "No matching SMS arrived in time".to_owned(),
                });
            }
            tokio::time::sleep(WAIT_POLL_INTERVAL).await;
        }
    }
}

/// How long to wait (at most a minute) and how far back a match may be.
fn read_wait_window(
    operation_context: &OperationContext,
    input: &WaitSmsInput,
) -> Result<(Duration, i64), OperationError> {
    let wait_duration = match input.timeout.as_deref() {
        Some(timeout_text) => {
            Duration::from_millis(sendmock_core::parse_duration_ms(timeout_text).ok_or_else(
                || OperationError::InvalidInput {
                    message: format!("timeout must be a duration such as 10s, not {timeout_text}"),
                    field: Some("timeout".to_owned()),
                },
            )?)
        }
        None => DEFAULT_WAIT,
    };
    let since_unix_ms = match input.since.as_deref() {
        Some(since_text) => {
            parse_rfc3339(since_text).ok_or_else(|| OperationError::InvalidInput {
                message: format!(
                    "since must be a time such as 2026-10-26T09:30:00Z, not {since_text}"
                ),
                field: Some("since".to_owned()),
            })?
        }
        None => operation_context.clock.now_unix_ms() - DEFAULT_LOOKBACK_MS,
    };
    Ok((wait_duration.min(MAXIMUM_WAIT), since_unix_ms))
}
