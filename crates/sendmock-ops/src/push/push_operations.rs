use std::time::Duration;

use sendmock_core::parse_rfc3339;
use sendmock_store::PushNotificationFilter;

use super::push_inputs::{PushListQuery, PushReference, PushWaitQuery};
use super::push_views::PushNotification;
use crate::email::read_wait_duration;
use crate::{
    HttpMethod, NoContent, Operation, OperationContext, OperationDefinition, OperationError,
    PageOf, SuccessStatus,
};

const DEFAULT_PAGE_SIZE: u32 = 50;
const MAXIMUM_PAGE_SIZE: u32 = 200;
const DEFAULT_WAIT: Duration = Duration::from_secs(10);
const MAXIMUM_WAIT: Duration = Duration::from_secs(60);
const DEFAULT_SINCE_MS: i64 = 30_000;
const WAIT_POLL_INTERVAL: Duration = Duration::from_millis(100);

fn build_filter(list_query: &PushListQuery) -> PushNotificationFilter {
    PushNotificationFilter {
        project_key: list_query.project.clone(),
        device_token: list_query.device_token.clone(),
        provider: list_query.provider.clone(),
        status: list_query.status.clone(),
        created_after_unix_ms: None,
    }
}

fn push_not_found(push_id: &str) -> OperationError {
    OperationError::NotFound {
        message: format!("No push notification with id {push_id}"),
    }
}

pub struct ListPushesOperation;

impl Operation for ListPushesOperation {
    type Input = PushListQuery;
    type Output = PageOf<PushNotification>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getPush",
            method: HttpMethod::Get,
            path: "/api/v1/push",
            summary: "Push notifications, newest first, with filters.",
            is_read_only: true,
            cli_usage: "sendmock push list",
            mcp_tool: "sendmock_push_list",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PushListQuery,
    ) -> Result<PageOf<PushNotification>, OperationError> {
        let page_size = input
            .limit
            .unwrap_or(DEFAULT_PAGE_SIZE)
            .clamp(1, MAXIMUM_PAGE_SIZE);
        let page = operation_context
            .push_notifications
            .list_notifications(build_filter(&input), input.cursor, page_size)
            .await?;
        Ok(PageOf {
            items: page
                .notifications
                .into_iter()
                .map(PushNotification::from)
                .collect(),
            next_cursor: page.next_cursor,
            total_count: page.total_count,
        })
    }
}

pub struct GetPushOperation;

impl Operation for GetPushOperation {
    type Input = PushReference;
    type Output = PushNotification;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getPushByPushId",
            method: HttpMethod::Get,
            path: "/api/v1/push/{pushId}",
            summary: "One push notification with its request and answer.",
            is_read_only: true,
            cli_usage: "sendmock push show <pushId>",
            mcp_tool: "sendmock_push_get",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PushReference,
    ) -> Result<PushNotification, OperationError> {
        operation_context
            .push_notifications
            .find_notification(&input.push_id)
            .await?
            .map(PushNotification::from)
            .ok_or_else(|| push_not_found(&input.push_id))
    }
}

pub struct DeletePushOperation;

impl Operation for DeletePushOperation {
    type Input = PushReference;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deletePushByPushId",
            method: HttpMethod::Delete,
            path: "/api/v1/push/{pushId}",
            summary: "Delete one push notification.",
            is_destructive: true,
            cli_usage: "sendmock push delete <pushId>",
            mcp_tool: "sendmock_push_delete",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Deleting a notification that is already gone also succeeds, so retries are safe.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PushReference,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .push_notifications
            .delete_notification(&input.push_id)
            .await?;
        Ok(NoContent)
    }
}

pub struct DeletePushesOperation;

impl Operation for DeletePushesOperation {
    type Input = PushListQuery;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "deletePush",
            method: HttpMethod::Delete,
            path: "/api/v1/push",
            summary: "Delete every push notification, or one project's.",
            is_destructive: true,
            cli_usage: "sendmock push clear",
            mcp_tool: "sendmock_push_delete_all",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PushListQuery,
    ) -> Result<NoContent, OperationError> {
        operation_context
            .push_notifications
            .delete_notifications(input.project)
            .await?;
        Ok(NoContent)
    }
}

pub struct WaitPushOperation;

impl Operation for WaitPushOperation {
    type Input = PushWaitQuery;
    type Output = PushNotification;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getWaitPush",
            method: HttpMethod::Get,
            path: "/api/v1/wait/push",
            summary: "Wait until a matching push notification arrives; 408 on timeout.",
            is_read_only: true,
            cli_usage: "sendmock push wait",
            mcp_tool: "sendmock_push_wait",
            cli_flag_names: &[("timeout", "wait")],
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: PushWaitQuery,
    ) -> Result<PushNotification, OperationError> {
        let wait_duration =
            read_wait_duration(input.timeout.as_deref(), DEFAULT_WAIT)?.min(MAXIMUM_WAIT);
        let filter = PushNotificationFilter {
            project_key: input.project.clone(),
            device_token: input.device_token.clone(),
            created_after_unix_ms: Some(read_since(operation_context, input.since.as_deref())?),
            ..PushNotificationFilter::default()
        };
        let deadline = tokio::time::Instant::now() + wait_duration;
        loop {
            let page = operation_context
                .push_notifications
                .list_notifications(filter.clone(), None, 1)
                .await?;
            if let Some(newest_notification) = page.notifications.into_iter().next() {
                return Ok(PushNotification::from(newest_notification));
            }
            if tokio::time::Instant::now() >= deadline {
                return Err(OperationError::Timeout {
                    message: "No matching push notification arrived in time".to_owned(),
                });
            }
            tokio::time::sleep(WAIT_POLL_INTERVAL).await;
        }
    }
}

/// How far back a match may be: `since`, or 30 seconds ago.
fn read_since(
    operation_context: &OperationContext,
    since_text: Option<&str>,
) -> Result<i64, OperationError> {
    match since_text {
        Some(since_text) => parse_rfc3339(since_text)
            .map(|since_unix_ms| since_unix_ms - 1)
            .ok_or_else(|| OperationError::InvalidInput {
                message: format!(
                    "`since` must be an RFC 3339 time, such as 2026-11-07T10:00:00Z, not {since_text}"
                ),
                field: Some("since".to_owned()),
            }),
        None => Ok(operation_context.clock.now_unix_ms() - DEFAULT_SINCE_MS),
    }
}
