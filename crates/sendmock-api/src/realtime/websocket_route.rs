use axum::extract::ws::{CloseFrame, Message, WebSocket, WebSocketUpgrade};
use axum::extract::{Query, State};
use axum::response::Response;
use sendmock_ops::OperationContext;
use serde::Deserialize;

use super::resumable_event_stream::ResumableEventStream;

/// A close code in the range left to applications (RFC 6455, 7.4.2), with a reason the web UI
/// and scripts can read: the client fell behind and should reconnect and refetch.
const FELL_BEHIND_CLOSE_CODE: u16 = 4000;
const FELL_BEHIND_CLOSE_REASON: &str = "lagged";

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
                let app_event = match next_event {
                    Ok(Some(app_event)) => app_event,
                    Ok(None) => break,
                    Err(_) => {
                        // The client may already be gone; it is closed either way.
                        let _ = websocket.send(Message::Close(Some(build_fell_behind_close_frame()))).await;
                        break;
                    }
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

/// The close frame for a client that fell behind (PL-02.5).
fn build_fell_behind_close_frame() -> CloseFrame {
    CloseFrame {
        code: FELL_BEHIND_CLOSE_CODE,
        reason: FELL_BEHIND_CLOSE_REASON.into(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // AC: PL-02.5
    #[test]
    fn a_client_that_fell_behind_is_closed_with_the_lagged_reason() {
        let close_frame = build_fell_behind_close_frame();

        assert_eq!(close_frame.code, 4000);
        assert_eq!(close_frame.reason.as_str(), "lagged");
    }
}
