use std::collections::VecDeque;
use std::sync::{Arc, Mutex, PoisonError};

use tokio::sync::broadcast;

use super::app_event::RecordedEvent;

/// Events kept for `/events/recent` and for clients that reconnect.
const RECENT_EVENT_CAPACITY: usize = 1000;
/// Live events a slow subscriber may fall behind by before it misses some.
const SUBSCRIBER_BUFFER_CAPACITY: usize = 1024;

/// Which recent events to answer, newest first.
#[derive(Debug, Clone, Default)]
pub struct RecentEventFilter {
    pub created_after_unix_ms: Option<i64>,
    pub event_type: Option<String>,
    pub limit: usize,
}

/// Producers publish events; the realtime streams (and webhooks later) subscribe. The last
/// events stay in memory for polling and for resuming after a reconnect.
#[derive(Clone)]
pub struct EventBus {
    live_events: broadcast::Sender<RecordedEvent>,
    recent_events: Arc<Mutex<RecentEvents>>,
}

#[derive(Default)]
struct RecentEvents {
    next_sequence: u64,
    events: VecDeque<RecordedEvent>,
}

impl Default for EventBus {
    fn default() -> Self {
        Self {
            live_events: broadcast::channel(SUBSCRIBER_BUFFER_CAPACITY).0,
            recent_events: Arc::default(),
        }
    }
}

impl EventBus {
    /// Gives the event the next sequence number, keeps it and sends it to subscribers.
    pub fn publish(&self, mut recorded_event: RecordedEvent) -> RecordedEvent {
        let mut recent_events = self
            .recent_events
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        recent_events.next_sequence += 1;
        recorded_event.sequence = recent_events.next_sequence;
        if recent_events.events.len() == RECENT_EVENT_CAPACITY {
            recent_events.events.pop_front();
        }
        recent_events.events.push_back(recorded_event.clone());
        // Sent while the lock is held, so subscribers see events in sequence order.
        let _ = self.live_events.send(recorded_event.clone());
        recorded_event
    }

    pub fn subscribe(&self) -> broadcast::Receiver<RecordedEvent> {
        self.live_events.subscribe()
    }

    pub fn recent_events(&self, filter: &RecentEventFilter) -> Vec<RecordedEvent> {
        let recent_events = self
            .recent_events
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        recent_events
            .events
            .iter()
            .rev()
            .filter(|recorded_event| {
                filter
                    .created_after_unix_ms
                    .is_none_or(|created_after| recorded_event.created_at_unix_ms > created_after)
                    && filter
                        .event_type
                        .as_ref()
                        .is_none_or(|event_type| &recorded_event.app_event.event_type == event_type)
            })
            .take(filter.limit)
            .cloned()
            .collect()
    }

    /// The events after `event_id`, oldest first, for a client that reconnects; empty when
    /// the id is unknown or too old to be kept.
    pub fn events_after(&self, event_id: &str) -> Vec<RecordedEvent> {
        let recent_events = self
            .recent_events
            .lock()
            .unwrap_or_else(PoisonError::into_inner);
        let Some(position) = recent_events
            .events
            .iter()
            .position(|recorded_event| recorded_event.app_event.id == event_id)
        else {
            return Vec::new();
        };
        recent_events
            .events
            .iter()
            .skip(position + 1)
            .cloned()
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;
    use crate::events::AppEvent;

    fn recorded(event_id: &str, event_type: &str, created_at_unix_ms: i64) -> RecordedEvent {
        RecordedEvent {
            sequence: 0,
            created_at_unix_ms,
            app_event: AppEvent {
                id: event_id.to_owned(),
                event_type: event_type.to_owned(),
                created_at: String::new(),
                data: json!({}),
            },
        }
    }

    fn event_ids(recorded_events: &[RecordedEvent]) -> Vec<&str> {
        recorded_events
            .iter()
            .map(|recorded_event| recorded_event.app_event.id.as_str())
            .collect()
    }

    #[tokio::test]
    async fn subscribers_get_each_event_with_a_rising_sequence() {
        let event_bus = EventBus::default();
        let mut subscriber = event_bus.subscribe();

        event_bus.publish(recorded("evt_1", "email.received", 1));
        event_bus.publish(recorded("evt_2", "email.received", 2));

        let first = subscriber.recv().await.map(|event| event.sequence).ok();
        let second = subscriber.recv().await.map(|event| event.sequence).ok();
        assert_eq!((first, second), (Some(1), Some(2)));
    }

    #[test]
    fn recent_events_come_newest_first_with_filters() {
        let event_bus = EventBus::default();
        event_bus.publish(recorded("evt_1", "email.received", 100));
        event_bus.publish(recorded("evt_2", "email.deleted", 200));
        event_bus.publish(recorded("evt_3", "email.received", 300));

        let everything = event_bus.recent_events(&RecentEventFilter {
            limit: 10,
            ..RecentEventFilter::default()
        });
        let received_after_100 = event_bus.recent_events(&RecentEventFilter {
            created_after_unix_ms: Some(100),
            event_type: Some("email.received".to_owned()),
            limit: 10,
        });

        assert_eq!(event_ids(&everything), ["evt_3", "evt_2", "evt_1"]);
        assert_eq!(event_ids(&received_after_100), ["evt_3"]);
    }

    #[test]
    fn keeps_only_the_latest_events() {
        let event_bus = EventBus::default();
        for event_number in 0..RECENT_EVENT_CAPACITY + 5 {
            event_bus.publish(recorded(
                &format!("evt_{event_number}"),
                "email.received",
                1,
            ));
        }

        let kept = event_bus.recent_events(&RecentEventFilter {
            limit: usize::MAX,
            ..RecentEventFilter::default()
        });

        assert_eq!(kept.len(), RECENT_EVENT_CAPACITY);
        assert_eq!(event_bus.events_after("evt_0"), Vec::new());
    }

    // AC: PL-02.2
    #[test]
    fn a_reconnecting_client_gets_exactly_the_events_it_missed() {
        let event_bus = EventBus::default();
        event_bus.publish(recorded("evt_1", "email.received", 1));
        event_bus.publish(recorded("evt_2", "email.received", 2));
        event_bus.publish(recorded("evt_3", "email.received", 3));

        assert_eq!(
            event_ids(&event_bus.events_after("evt_1")),
            ["evt_2", "evt_3"]
        );
        assert!(event_bus.events_after("evt_unknown").is_empty());
    }
}
