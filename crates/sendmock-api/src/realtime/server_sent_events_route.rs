use std::convert::Infallible;

use axum::extract::{Query, State};
use axum::http::HeaderMap;
use axum::response::sse::{Event, KeepAlive, Sse};
use futures_util::Stream;
use futures_util::stream::unfold;
use sendmock_ops::OperationContext;

use super::resumable_event_stream::ResumableEventStream;
use super::websocket_route::RealtimeQuery;

/// The header browsers send when an `EventSource` reconnects.
const LAST_EVENT_ID_HEADER: &str = "last-event-id";

/// `GET /api/v1/events`: the same events as Server-Sent Events, with the event id so a
/// reconnecting client resumes where it stopped.
pub async fn open_event_stream(
    headers: HeaderMap,
    Query(realtime_query): Query<RealtimeQuery>,
    State(operation_context): State<OperationContext>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let last_event_id = headers
        .get(LAST_EVENT_ID_HEADER)
        .and_then(|header_value| header_value.to_str().ok())
        .map(str::to_owned)
        .or(realtime_query.last_event_id);
    let event_stream =
        ResumableEventStream::open(&operation_context.event_bus, last_event_id.as_deref());
    let server_sent_events = unfold(event_stream, |mut event_stream| async move {
        let app_event = event_stream.next_event().await?;
        let server_sent_event = Event::default()
            .id(app_event.id.clone())
            .event(app_event.event_type.clone())
            .data(serde_json::to_string(&app_event).unwrap_or_default());
        Some((Ok(server_sent_event), event_stream))
    });
    Sse::new(server_sent_events).keep_alive(KeepAlive::default())
}
