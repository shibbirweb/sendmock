use schemars::JsonSchema;
use sendmock_core::format_rfc3339;
use sendmock_store::{EmailClickRecord as StoredEmailClick, RecordedEmailClick, TimelineRecord};
use serde::{Deserialize, Serialize};
use serde_json::json;

use super::email_access::find_email_or_not_found;
use super::email_inputs::EmailReference;
use super::email_summary::EmailSummary;
use crate::opens::read_user_agent;
use crate::{
    AppEventType, HttpMethod, NoContent, OpenSource, Operation, OperationContext,
    OperationDefinition, OperationError, SuccessStatus, publish_event,
};

/// Body of `POST /api/v1/emails/{emailId}/clicks`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct EmailClickRequest {
    pub email_id: String,
    /// The link that was clicked; one of the email's links.
    pub url: String,
    /// Who clicked it; `api` when not given.
    pub source: Option<OpenSource>,
    /// The browser or client that clicked, kept in the click history.
    pub user_agent: Option<String>,
}

/// One click on a link of an email, as the click history lists it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, JsonSchema)]
pub struct EmailClickRecord {
    pub clicked_at: String,
    pub url: String,
    /// `ui`, `manual` or `api`.
    pub source: String,
    #[schemars(required, schema_with = "crate::nullable_schema::<String>")]
    pub user_agent: Option<String>,
}

impl From<StoredEmailClick> for EmailClickRecord {
    fn from(stored_click: StoredEmailClick) -> Self {
        Self {
            clicked_at: format_rfc3339(stored_click.clicked_at_unix_ms),
            url: stored_click.url,
            source: stored_click.source,
            user_agent: stored_click.user_agent,
        }
    }
}

fn describe_click(click_source: OpenSource) -> &'static str {
    match click_source {
        OpenSource::Ui => "Link clicked in the SendMock preview",
        OpenSource::Manual => "Link clicked with Simulate click",
        OpenSource::Api => "Link clicked through the API",
    }
}

pub struct RecordEmailClickOperation;

impl Operation for RecordEmailClickOperation {
    type Input = EmailClickRequest;
    type Output = NoContent;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "postEmailsByEmailIdClicks",
            method: HttpMethod::Post,
            path: "/api/v1/emails/{emailId}/clicks",
            summary: "Record a click on one of the email's links and fire email.clicked.",
            cli_usage: "sendmock email click <emailId>",
            mcp_tool: "sendmock_email_click",
            success_status: SuccessStatus::NoContent,
            ..OperationDefinition::DEFAULTS
        }
    }

    /// Only the email's own links count, as a provider tracks only the links it rewrote.
    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailClickRequest,
    ) -> Result<NoContent, OperationError> {
        let email = find_email_or_not_found(operation_context, &input.email_id).await?;
        if !email.links.contains(&input.url) {
            let email_links = if email.links.is_empty() {
                "it has none".to_owned()
            } else {
                email.links.join(", ")
            };
            return Err(OperationError::Unprocessable {
                code: "unknown_link",
                message: format!(
                    "{} is not one of the email's links: {email_links}",
                    input.url
                ),
            });
        }
        let click_source = input.source.unwrap_or_default();
        let email_click = StoredEmailClick {
            clicked_at_unix_ms: operation_context.clock.now_unix_ms(),
            url: input.url,
            source: click_source.as_str().to_owned(),
            user_agent: read_user_agent(input.user_agent)?,
        };
        let timeline_entry = TimelineRecord {
            kind: "clicked".to_owned(),
            happened_at_unix_ms: email_click.clicked_at_unix_ms,
            detail: format!("{}: {}", describe_click(click_source), email_click.url),
        };
        let recorded_click = operation_context
            .email_repository
            .record_click(&input.email_id, email_click.clone(), timeline_entry)
            .await?;
        if let Some(recorded_click) = recorded_click {
            let mut event_data =
                serde_json::to_value(EmailSummary::from(&email)).unwrap_or_default();
            add_click_fields(&mut event_data, &email_click, recorded_click);
            publish_event(operation_context, AppEventType::EmailClicked, event_data);
        }
        Ok(NoContent)
    }
}

/// `email.clicked` carries the email as the list shows it, plus the click.
fn add_click_fields(
    event_data: &mut serde_json::Value,
    email_click: &StoredEmailClick,
    recorded_click: RecordedEmailClick,
) {
    event_data["url"] = json!(email_click.url);
    event_data["clicked_at"] = json!(format_rfc3339(email_click.clicked_at_unix_ms));
    event_data["first_click"] = json!(recorded_click.is_first_click);
    event_data["click_count"] = json!(recorded_click.click_count);
    event_data["source"] = json!(email_click.source);
    event_data["user_agent"] = json!(email_click.user_agent);
}

pub struct ListEmailClicksOperation;

impl Operation for ListEmailClicksOperation {
    type Input = EmailReference;
    type Output = Vec<EmailClickRecord>;

    fn definition(&self) -> OperationDefinition {
        OperationDefinition {
            operation_id: "getEmailsByEmailIdClicks",
            method: HttpMethod::Get,
            path: "/api/v1/emails/{emailId}/clicks",
            summary: "Every recorded click on the email's links, newest first.",
            is_read_only: true,
            cli_usage: "sendmock email clicks <emailId>",
            mcp_tool: "sendmock_email_clicks",
            ..OperationDefinition::DEFAULTS
        }
    }

    async fn execute(
        &self,
        operation_context: &OperationContext,
        input: EmailReference,
    ) -> Result<Vec<EmailClickRecord>, OperationError> {
        find_email_or_not_found(operation_context, &input.email_id).await?;
        let stored_clicks = operation_context
            .email_repository
            .list_clicks(&input.email_id)
            .await?;
        Ok(stored_clicks
            .into_iter()
            .map(EmailClickRecord::from)
            .collect())
    }
}
