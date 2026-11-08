mod resumable_event_stream;
mod server_sent_events_route;
mod websocket_route;

use axum::Router;
use axum::routing::get;
use sendmock_ops::OperationContext;

pub const WEBSOCKET_PATH: &str = "/api/v1/ws";
pub const SERVER_SENT_EVENTS_PATH: &str = "/api/v1/events";

/// The realtime streams. OpenAPI does not describe them; `GET /events/recent` is their twin.
pub fn build_realtime_router(operation_context: &OperationContext) -> Router {
    Router::new()
        .route(WEBSOCKET_PATH, get(websocket_route::open_websocket))
        .route(
            SERVER_SENT_EVENTS_PATH,
            get(server_sent_events_route::open_event_stream),
        )
        .with_state(operation_context.clone())
}
