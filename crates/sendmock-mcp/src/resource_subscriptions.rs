//! Resource subscriptions: clients subscribed to the email, SMS or delivery lists hear when a
//! new one arrives (AI-03.2). The recent events are polled through the same operation runner
//! as the tools, so it works in the server and over stdio alike.

use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use rmcp::RoleServer;
use rmcp::model::{
    ResourceUpdatedNotification, ResourceUpdatedNotificationParam, ServerNotification,
};
use rmcp::service::Peer;
use sendmock_ops::OperationAnswer;
use serde_json::{Map, Value, json};

use crate::McpToolCatalog;

const POLL_INTERVAL: Duration = Duration::from_millis(500);
/// Ids remembered so an event is announced once; old ones fall out of the recent list anyway.
const SEEN_EVENT_CAPACITY: usize = 2_000;

/// The list resource a new event changes, if any.
pub fn find_changed_collection(event_type: &str) -> Option<&'static str> {
    match event_type {
        "email.received" | "email.inbound" => Some("sendmock://emails"),
        "sms.sent" | "sms.inbound" => Some("sendmock://sms"),
        "webhook.delivered" | "webhook.failed" => Some("sendmock://webhooks/deliveries"),
        _ => None,
    }
}

/// Who listens to which resource; the watcher starts with the first subscription.
#[derive(Default)]
pub struct ResourceSubscriptions {
    listeners: Mutex<Vec<(String, Peer<RoleServer>)>>,
    is_watching: AtomicBool,
}

impl ResourceSubscriptions {
    pub fn subscribe(
        self: &Arc<Self>,
        uri: String,
        peer: Peer<RoleServer>,
        tool_catalog: Arc<McpToolCatalog>,
    ) {
        if let Ok(mut listeners) = self.listeners.lock() {
            listeners.push((uri, peer));
        }
        if !self.is_watching.swap(true, Ordering::SeqCst) {
            tokio::spawn(watch_events(Arc::clone(self), tool_catalog));
        }
    }

    pub fn unsubscribe(&self, uri: &str) {
        if let Ok(mut listeners) = self.listeners.lock() {
            listeners.retain(|(listened_uri, _)| listened_uri != uri);
        }
    }

    fn list_peers_for(&self, uri: &str) -> Vec<Peer<RoleServer>> {
        self.listeners
            .lock()
            .map(|listeners| {
                listeners
                    .iter()
                    .filter(|(listened_uri, _)| listened_uri == uri)
                    .map(|(_, peer)| peer.clone())
                    .collect()
            })
            .unwrap_or_default()
    }
}

/// The ids and types of the newest events.
async fn read_recent_events(tool_catalog: &McpToolCatalog) -> Vec<(String, String)> {
    let recent_input: Map<String, Value> = json!({ "limit": 50 })
        .as_object()
        .cloned()
        .unwrap_or_default();
    match tool_catalog
        .run_operation_by_id("getEventsRecent", recent_input)
        .await
    {
        Ok(OperationAnswer::Json(Value::Array(recent_events))) => recent_events
            .iter()
            .filter_map(|recent_event| {
                Some((
                    recent_event["id"].as_str()?.to_owned(),
                    recent_event["type"].as_str()?.to_owned(),
                ))
            })
            .collect(),
        _ => Vec::new(),
    }
}

async fn notify_updated(resource_subscriptions: &ResourceSubscriptions, uri: &str) {
    for peer in resource_subscriptions.list_peers_for(uri) {
        let notification = ServerNotification::ResourceUpdatedNotification(
            ResourceUpdatedNotification::new(ResourceUpdatedNotificationParam::new(uri)),
        );
        let _ = peer.send_notification(notification).await;
    }
}

async fn watch_events(
    resource_subscriptions: Arc<ResourceSubscriptions>,
    tool_catalog: Arc<McpToolCatalog>,
) {
    let mut seen_event_ids: HashSet<String> = read_recent_events(&tool_catalog)
        .await
        .into_iter()
        .map(|(event_id, _)| event_id)
        .collect();
    loop {
        tokio::time::sleep(POLL_INTERVAL).await;
        for (event_id, event_type) in read_recent_events(&tool_catalog).await {
            if !seen_event_ids.insert(event_id) {
                continue;
            }
            if let Some(changed_uri) = find_changed_collection(&event_type) {
                notify_updated(&resource_subscriptions, changed_uri).await;
            }
        }
        if seen_event_ids.len() > SEEN_EVENT_CAPACITY {
            seen_event_ids.clear();
            seen_event_ids.extend(
                read_recent_events(&tool_catalog)
                    .await
                    .into_iter()
                    .map(|(event_id, _)| event_id),
            );
        }
    }
}
