use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use sendmock_core::parse_rfc2822;
use serde_json::{Map, Value, json};

use super::mailgun_complaint_recording::MAILGUN_PROVIDER_KEY;
use super::mailgun_event_items::{MailgunEmailRecords, MailgunEvent, build_email_events};
use crate::providers::{
    ProviderHttpRequest, ProviderHttpResponse, answer_json, read_request_fields,
};
use crate::{OperationContext, OperationError};

/// Mailgun answers at most 300 events a page.
const MAXIMUM_PAGE_SIZE: usize = 300;

/// The filters of one events query, as Mailgun's `GET /v3/{domain}/events` takes them.
#[derive(Debug, Clone, Default)]
pub struct EventsQuery {
    pub fields: Map<String, Value>,
    pub offset: usize,
}

impl EventsQuery {
    fn read_text(&self, field_name: &str) -> Option<String> {
        self.fields
            .get(field_name)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
    }

    fn read_time_ms(&self, field_name: &str) -> Option<i64> {
        let time_text = self.read_text(field_name)?;
        #[allow(
            clippy::cast_possible_truncation,
            reason = "seconds since 1970 fit in i64 milliseconds"
        )]
        let from_seconds = time_text
            .parse::<f64>()
            .ok()
            .map(|seconds| (seconds * 1000.0) as i64);
        from_seconds.or_else(|| parse_rfc2822(&time_text))
    }

    fn page_size(&self) -> usize {
        self.read_text("limit")
            .and_then(|limit_text| limit_text.parse::<usize>().ok())
            .map_or(MAXIMUM_PAGE_SIZE, |limit| limit.clamp(1, MAXIMUM_PAGE_SIZE))
    }

    fn is_ascending(&self) -> bool {
        self.read_text("ascending")
            .is_some_and(|ascending| ascending.eq_ignore_ascii_case("yes"))
    }

    /// The query of another page, as a URL path segment.
    fn to_page_token(&self, offset: usize) -> String {
        let token_fields = json!({ "query": self.fields, "offset": offset });
        URL_SAFE_NO_PAD.encode(token_fields.to_string())
    }

    pub fn from_page_token(page_token: &str) -> Option<Self> {
        let token_bytes = URL_SAFE_NO_PAD.decode(page_token).ok()?;
        let token_fields: Value = serde_json::from_slice(&token_bytes).ok()?;
        Some(Self {
            fields: token_fields["query"]
                .as_object()
                .cloned()
                .unwrap_or_default(),
            offset: usize::try_from(token_fields["offset"].as_u64()?).ok()?,
        })
    }

    pub fn from_request(request: &ProviderHttpRequest) -> Self {
        Self {
            fields: read_request_fields(request, "query")
                .and_then(|fields| fields.as_object().cloned())
                .unwrap_or_default(),
            offset: 0,
        }
    }
}

fn contains_text(haystack: &str, needle: &str) -> bool {
    haystack.to_lowercase().contains(&needle.to_lowercase())
}

/// Whether an event passes every filter of the query.
fn matches_filters(event: &MailgunEvent, query: &EventsQuery) -> bool {
    let headers = &event.item["message"]["headers"];
    let read_header = |header_name: &str| headers[header_name].as_str().unwrap_or_default();
    let event_names = query.read_text("event");
    let checks = [
        event_names.as_deref().is_none_or(|names| {
            names
                .split(" OR ")
                .any(|name| name.trim().eq_ignore_ascii_case(&event.event_name))
        }),
        query
            .read_text("recipient")
            .is_none_or(|recipient| recipient.eq_ignore_ascii_case(&event.recipient)),
        query.read_text("message-id").is_none_or(|message_id| {
            message_id.trim_matches(['<', '>']) == read_header("message-id")
        }),
        query
            .read_text("from")
            .is_none_or(|from| contains_text(read_header("from"), &from)),
        query
            .read_text("to")
            .is_none_or(|to| contains_text(read_header("to"), &to)),
        query
            .read_text("subject")
            .is_none_or(|subject| contains_text(read_header("subject"), &subject)),
        query.read_text("tags").is_none_or(|tag| {
            event.item["tags"]
                .as_array()
                .is_some_and(|tags| tags.iter().any(|candidate| candidate == tag.as_str()))
        }),
        query
            .read_text("severity")
            .is_none_or(|severity| event.severity.as_deref() == Some(severity.as_str())),
        query
            .read_time_ms("begin")
            .is_none_or(|begin_ms| event.happened_at_unix_ms >= begin_ms),
        query
            .read_time_ms("end")
            .is_none_or(|end_ms| event.happened_at_unix_ms <= end_ms),
    ];
    checks.into_iter().all(|is_passed| is_passed)
}

/// Every event of the emails sent through Mailgun for this domain.
async fn collect_domain_events(
    operation_context: &OperationContext,
    domain: &str,
) -> Result<Vec<MailgunEvent>, OperationError> {
    let provider_sends = operation_context
        .email_stores
        .sends
        .list_sends_for_domain(MAILGUN_PROVIDER_KEY, domain)
        .await?;
    let email_repository = &operation_context.email_repository;
    let mut events = Vec::new();
    for provider_send in provider_sends {
        let Some(email) = email_repository.find_email(&provider_send.email_id).await? else {
            continue;
        };
        let records = MailgunEmailRecords {
            message_url: crate::webhooks::build_message_url(
                &operation_context.instance_details,
                domain,
                &email.email_id,
            ),
            timeline: email_repository.list_timeline(&email.email_id).await?,
            opens: email_repository.list_opens(&email.email_id).await?,
            clicks: email_repository.list_clicks(&email.email_id).await?,
            email,
            provider_send,
        };
        events.extend(build_email_events(&records));
    }
    Ok(events)
}

/// `GET /v3/{domain}/events`: Mailgun's `items` and `paging`, newest first unless `ascending`
/// is `yes`; the paging URLs answer the next and previous pages.
pub async fn answer_events(
    operation_context: &OperationContext,
    domain: &str,
    query: &EventsQuery,
    base_url: &str,
) -> Result<ProviderHttpResponse, OperationError> {
    let mut events: Vec<MailgunEvent> = collect_domain_events(operation_context, domain)
        .await?
        .into_iter()
        .filter(|event| matches_filters(event, query))
        .collect();
    events.sort_by_key(|event| event.happened_at_unix_ms);
    if !query.is_ascending() {
        events.reverse();
    }
    let page_size = query.page_size();
    let page_items: Vec<Value> = events
        .iter()
        .skip(query.offset)
        .take(page_size)
        .map(|event| event.item.clone())
        .collect();
    let last_offset = events.len().saturating_sub(1) / page_size * page_size;
    let page_url = |offset: usize| {
        format!(
            "{base_url}/v3/{domain}/events/{}",
            query.to_page_token(offset)
        )
    };
    Ok(answer_json(
        200,
        json!({
            "items": page_items,
            "paging": {
                "first": page_url(0),
                "last": page_url(last_offset),
                "next": page_url(query.offset + page_size),
                "previous": page_url(query.offset.saturating_sub(page_size)),
            },
        }),
    ))
}
