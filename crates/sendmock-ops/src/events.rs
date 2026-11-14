mod app_event;
mod event_bus;
mod event_publishing;
mod get_recent_events_operation;
mod webhook_choice;

pub use app_event::{AppEvent, AppEventType, RecordedEvent};
pub use event_bus::{EventBus, RecentEventFilter};
pub use event_publishing::{
    publish_email_deleted, publish_email_inbound, publish_email_received, publish_event,
    publish_traffic_pruned,
};
pub use get_recent_events_operation::{GetRecentEventsOperation, RecentEventsInput};
pub use webhook_choice::{EditedWebhookRequest, WebhookChoice};

use crate::OperationRegistry;

pub fn register_event_operations(operation_registry: &mut OperationRegistry) {
    operation_registry.register(GetRecentEventsOperation);
}
