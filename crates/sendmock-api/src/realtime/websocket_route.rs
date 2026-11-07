use axum::extract::ws::{Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::response::Response;
use sendmock_ops::OperationContext;
use serde::Deserialize;

use super::resumable_event_stream::ResumableEventStream;

#[derive(Debug, Default, Deserialize)]
pub struct RealtimeQuery {
    /// The last event the client received, to get the ones it missed while away.
    pub last_event_id: Option<String>,
}

/// `GET /api/v1/ws`: one JSON event envelope per text frame.
pub async fn open_websocket(
    websocket_upgrade: WebSocketUpgrade,
    Query(realtime_query): Query<RealtimeQuery>,
    State(operation_context): State<OperationContext>,
) -> Response {
    websocket_upgrade.on_upgrade(move |websocket| {
        let event_stream = ResumableEventStream::open(
            &operation_context.event_bus,
            realtime_query.last_event_id.as_deref(),
        );
        push_events(websocket, event_stream)
    })
}

/// Sends events until the client goes away; messages from the client are not used.
async fn push_events(mut websocket: WebSocket, mut event_stream: ResumableEventStream) {
    loop {
        tokio::select! {
            next_event = event_stream.next_event() => {
                let Some(app_event) = next_event else {
                    break;
                };
                let event_json = serde_json::to_string(&app_event).unwrap_or_default();
                if websocket.send(Message::text(event_json)).await.is_err() {
                    break;
                }
            }
            client_message = websocket.recv() => {
                if matches!(client_message, None | Some(Err(_) | Ok(Message::Close(_)))) {
                    break;
                }
            }
        }
    }
}
