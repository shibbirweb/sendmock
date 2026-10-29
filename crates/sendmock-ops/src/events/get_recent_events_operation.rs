use schemars::JsonSchema;
use sendmock_core::parse_rfc3339;
use serde::Deserialize;

use super::app_event::AppEvent;
use super::event_bus::RecentEventFilter;
use crate::{HttpMethod, Operation, OperationContext, OperationDefinition, OperationError};

const DEFAULT_EVENT_LIMIT: u32 = 50;

#[derive(Debug, Deserialize, JsonSchema)]
pub struct RecentEventsInput {
    /// Only events newer than this time.
    pub since: Option<String>,
    /// An event type, e.g. http.captured.
    #[serde(rename = "type")]
    pub event_type: Option<String>,
    /// At most this many (default 50).
    pub limit: Option<u32>,
}

pub struct GetRecentEventsOperation;

impl Operation for GetRecentEventsOperation {
    type Input = RecentEventsInput;
    type Output = Vec<AppEvent>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getEventsRecent",
            method: HttpMethod::Get,
            path: "/api/v1/events/recent",
            summary: "The latest events, newest first: the polling twin of the live stream.",
            is_read_only: true,
            cli_usage: "sendmock events tail",
            mcp_tool: "sendmock_events_recent",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: RecentEventsInput,
    ) -> Result<Vec<AppEvent>, OperationError> {
        let created_after_unix_ms =
            match &input.since {
                Some(since_text) => Some(parse_rfc3339(since_text).ok_or_else(|| {
                    OperationError::InvalidInput {
                        message: format!(
                            "since must be a time such as 2026-10-26T09:30:00Z, not {since_text}"
                        ),
                        field: Some("since".to_owned()),
                    }
                })?),
                None => None,
            };
        let filter = RecentEventFilter {
            created_after_unix_ms,
            event_type: input.event_type,
            limit: input.limit.unwrap_or(DEFAULT_EVENT_LIMIT) as usize,
        };
        Ok(operation_context
            .event_bus
            .recent_events(&filter)
            .into_iter()
            .map(|recorded_event| recorded_event.app_event)
            .collect())
    }
}
