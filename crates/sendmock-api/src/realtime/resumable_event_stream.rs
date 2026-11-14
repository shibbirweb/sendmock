use std::collections::VecDeque;

use sendmock_ops::{AppEvent, EventBus, RecordedEvent};
use tokio::sync::broadcast::{self, error::RecvError};

/// The client read too slowly and the bus dropped events it had not sent yet; the caller
/// closes the connection so the client reconnects and refetches instead of missing them.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ClientFellBehind {
    pub skipped_count: u64,
}

/// The events one realtime client receives: first those it missed since `last_event_id`,
/// then live ones, each exactly once.
pub struct ResumableEventStream {
    missed_events: VecDeque<RecordedEvent>,
    live_events: broadcast::Receiver<RecordedEvent>,
    last_sent_sequence: u64,
}

impl ResumableEventStream {
    /// Subscribes before reading the missed events, so nothing published in between is lost;
    /// the sequence check drops what arrives twice.
    pub fn open(event_bus: &EventBus, last_event_id: Option<&str>) -> Self {
        let live_events = event_bus.subscribe();
        let missed_events = last_event_id
            .map(|event_id| event_bus.events_after(event_id))
            .unwrap_or_default();
        Self {
            missed_events: missed_events.into(),
            live_events,
            last_sent_sequence: 0,
        }
    }

    /// The next event, `None` once the bus is gone, or an error once the client fell behind.
    pub async fn next_event(&mut self) -> Result<Option<AppEvent>, ClientFellBehind> {
        if let Some(missed_event) = self.missed_events.pop_front() {
            self.last_sent_sequence = missed_event.sequence;
            return Ok(Some(missed_event.app_event));
        }
        loop {
            match self.live_events.recv().await {
                Ok(live_event) if live_event.sequence > self.last_sent_sequence => {
                    self.last_sent_sequence = live_event.sequence;
                    return Ok(Some(live_event.app_event));
                }
                Ok(_) => {}
                Err(RecvError::Lagged(skipped_count)) => {
                    tracing::warn!(
                        skipped_count,
                        "a realtime client fell behind; closing it so it reconnects"
                    );
                    return Err(ClientFellBehind { skipped_count });
                }
                Err(RecvError::Closed) => return Ok(None),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn recorded(event_id: &str) -> RecordedEvent {
        RecordedEvent {
            sequence: 0,
            created_at_unix_ms: 0,
            app_event: AppEvent {
                id: event_id.to_owned(),
                event_type: "email.received".to_owned(),
                created_at: String::new(),
                data: json!({}),
            },
            webhook_choice: None,
        }
    }

    // AC: PL-02.2
    #[tokio::test]
    async fn resumes_after_the_last_event_without_repeating_it() {
        let event_bus = EventBus::default();
        event_bus.publish(recorded("evt_1"));
        event_bus.publish(recorded("evt_2"));
        let mut stream = ResumableEventStream::open(&event_bus, Some("evt_1"));
        event_bus.publish(recorded("evt_3"));

        let first = stream
            .next_event()
            .await
            .ok()
            .flatten()
            .map(|event| event.id);
        let second = stream
            .next_event()
            .await
            .ok()
            .flatten()
            .map(|event| event.id);

        assert_eq!(first.as_deref(), Some("evt_2"));
        assert_eq!(second.as_deref(), Some("evt_3"));
    }

    #[tokio::test]
    async fn a_new_client_starts_with_live_events() {
        let event_bus = EventBus::default();
        event_bus.publish(recorded("evt_old"));
        let mut stream = ResumableEventStream::open(&event_bus, None);
        event_bus.publish(recorded("evt_new"));

        assert_eq!(
            stream
                .next_event()
                .await
                .ok()
                .flatten()
                .map(|event| event.id)
                .as_deref(),
            Some("evt_new")
        );
    }

    // AC: PL-02.5
    #[tokio::test]
    async fn a_client_that_falls_behind_is_told_instead_of_skipping_events() {
        let event_bus = EventBus::default();
        let mut stream = ResumableEventStream::open(&event_bus, None);
        for event_number in 0..1100 {
            event_bus.publish(recorded(&format!("evt_{event_number}")));
        }

        let next_event = stream.next_event().await;

        assert!(matches!(
            next_event,
            Err(ClientFellBehind { skipped_count }) if skipped_count > 0
        ));
    }
}
