#[allow(dead_code, reason = "each test file uses part of the shared support")]
mod support {
    pub mod test_app;
}

use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex};

use sendmock_ops::{EmailRelay, RecentEventFilter, RelayMessage};
use serde_json::{Value, json};
use support::test_app::{build_test_app_with, call_api};

/// What the fake relay was handed for one message.
#[derive(Debug, Clone, PartialEq)]
struct RelayedMessage {
    relay_url: String,
    mail_from: String,
    recipients: Vec<String>,
    raw_message: String,
}

/// Takes every message, except one for `refused@qa.example.test`, as a relay that refuses it.
#[derive(Default)]
struct FakeRelay {
    relayed_messages: Mutex<Vec<RelayedMessage>>,
}

impl FakeRelay {
    fn read_relayed_messages(&self) -> Vec<RelayedMessage> {
        self.relayed_messages
            .lock()
            .map(|relayed_messages| relayed_messages.clone())
            .unwrap_or_default()
    }
}

impl EmailRelay for FakeRelay {
    fn relay_message<'relay>(
        &'relay self,
        relay_message: RelayMessage<'relay>,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send + 'relay>> {
        if let Ok(mut relayed_messages) = self.relayed_messages.lock() {
            relayed_messages.push(RelayedMessage {
                relay_url: relay_message.relay_url.to_owned(),
                mail_from: relay_message.mail_from.to_owned(),
                recipients: relay_message.recipients.to_vec(),
                raw_message: String::from_utf8_lossy(relay_message.raw_message).into_owned(),
            });
        }
        let is_refused = relay_message
            .recipients
            .iter()
            .any(|recipient| recipient == "refused@qa.example.test");
        Box::pin(async move {
            if is_refused {
                Err("550 5.1.1 mailbox unavailable".to_owned())
            } else {
                Ok("250 2.0.0 queued".to_owned())
            }
        })
    }
}

fn build_app_with_relay() -> (axum::Router, sendmock_ops::OperationContext, Arc<FakeRelay>) {
    let fake_relay = Arc::new(FakeRelay::default());
    let (app_router, operation_context) = build_test_app_with(|operation_context| {
        operation_context.with_email_relay(fake_relay.clone())
    });
    (app_router, operation_context, fake_relay)
}

async fn configure_relay(app_router: &axum::Router, allowlist: &[&str]) {
    let (status, settings) = call_api(
        app_router,
        "PATCH",
        "/api/v1/settings",
        Some(&json!({
            "relay_smtp_url": "smtp://mailer:s3cret@relay.example.test:587",
            "relay_recipient_allowlist": allowlist,
        })),
    )
    .await;
    assert_eq!(status, 200, "{settings}");
}

async fn send_email(app_router: &axum::Router, recipient: &str) -> String {
    let (status, sent) = call_api(
        app_router,
        "POST",
        "/api/v1/send",
        Some(&json!({
            "from": "app@shop.test",
            "to": [recipient],
            "subject": "Your receipt",
            "text": "Thanks for your order",
        })),
    )
    .await;
    assert_eq!(status, 201, "{sent}");
    sent["id"].as_str().unwrap_or_default().to_owned()
}

async fn release(app_router: &axum::Router, email_id: &str, release_body: Value) -> (u16, Value) {
    call_api(
        app_router,
        "POST",
        &format!("/api/v1/emails/{email_id}/release"),
        Some(&release_body),
    )
    .await
}

// AC: EM-14.1
#[tokio::test]
async fn release_is_refused_until_a_relay_and_an_allowlist_are_set() {
    let (app_router, _, fake_relay) = build_app_with_relay();
    let email_id = send_email(&app_router, "qa@qa.example.test").await;

    let (unset_status, unset_refusal) = release(&app_router, &email_id, json!({})).await;
    configure_relay(&app_router, &[]).await;
    let (no_allowlist_status, _) = release(&app_router, &email_id, json!({})).await;

    assert_eq!(unset_status, 409, "{unset_refusal}");
    assert_eq!(unset_refusal["error"]["code"], "release_off");
    assert_eq!(no_allowlist_status, 409);
    assert!(fake_relay.read_relayed_messages().is_empty());
}

// AC: EM-14.2
#[tokio::test]
async fn release_sends_the_stored_message_to_the_original_or_chosen_allowlisted_recipients() {
    let (app_router, _, fake_relay) = build_app_with_relay();
    configure_relay(&app_router, &["*@QA.example.test"]).await;
    let email_id = send_email(&app_router, "sam@qa.example.test").await;

    let (original_status, _) = release(&app_router, &email_id, json!({})).await;
    let (chosen_status, _) = release(
        &app_router,
        &email_id,
        json!({ "to": ["lead@qa.example.test"] }),
    )
    .await;
    let (refused_status, refusal) = release(
        &app_router,
        &email_id,
        json!({ "to": ["lead@qa.example.test", "boss@example.test"] }),
    )
    .await;

    assert_eq!(original_status, 204);
    assert_eq!(chosen_status, 204);
    assert_eq!(refused_status, 400, "{refusal}");
    assert!(
        refusal["error"]["message"]
            .as_str()
            .is_some_and(
                |message| message.contains("boss@example.test") && !message.contains("lead@")
            ),
        "{refusal}"
    );
    let relayed_messages = fake_relay.read_relayed_messages();
    assert_eq!(relayed_messages.len(), 2);
    assert_eq!(relayed_messages[0].recipients, ["sam@qa.example.test"]);
    assert_eq!(relayed_messages[1].recipients, ["lead@qa.example.test"]);
    assert_eq!(relayed_messages[0].mail_from, "app@shop.test");
    assert_eq!(
        relayed_messages[0].relay_url,
        "smtp://mailer:s3cret@relay.example.test:587"
    );
    assert!(
        relayed_messages[0]
            .raw_message
            .contains("Subject: Your receipt")
    );
}

/// The details of the email's `released` timeline entries, oldest first.
async fn read_released_details(app_router: &axum::Router, email_id: &str) -> Vec<String> {
    let (_, timeline) = call_api(
        app_router,
        "GET",
        &format!("/api/v1/emails/{email_id}/timeline"),
        None,
    )
    .await;
    timeline
        .as_array()
        .into_iter()
        .flatten()
        .filter(|timeline_entry| timeline_entry["kind"] == "released")
        .filter_map(|timeline_entry| timeline_entry["detail"].as_str())
        .map(str::to_owned)
        .collect()
}

// AC: EM-14.4
#[tokio::test]
async fn every_release_is_on_the_timeline_with_its_result_and_fires_email_released() {
    let (app_router, operation_context, _) = build_app_with_relay();
    configure_relay(&app_router, &["*@qa.example.test"]).await;
    let email_id = send_email(&app_router, "sam@qa.example.test").await;

    release(&app_router, &email_id, json!({})).await;
    let (failed_status, failure) = release(
        &app_router,
        &email_id,
        json!({ "to": ["refused@qa.example.test"] }),
    )
    .await;

    assert_eq!(failed_status, 502, "{failure}");
    assert_eq!(failure["error"]["code"], "relay_failed");
    let released_details = read_released_details(&app_router, &email_id).await;
    assert_eq!(released_details.len(), 2, "{released_details:?}");
    assert!(released_details[0].contains("sam@qa.example.test"));
    assert!(released_details[0].contains("250 2.0.0 queued"));
    assert!(!released_details[0].contains("s3cret"));
    assert!(released_details[1].contains("failed: 550 5.1.1"));
    let released_events = operation_context
        .event_bus
        .recent_events(&RecentEventFilter {
            created_after_unix_ms: None,
            event_type: Some("email.released".to_owned()),
            limit: 10,
        });
    let released_data: Vec<&Value> = released_events
        .iter()
        .rev()
        .map(|recorded_event| &recorded_event.app_event.data)
        .collect();
    assert_eq!(released_data.len(), 2);
    assert_eq!(released_data[0]["id"], email_id.as_str());
    assert_eq!(released_data[0]["is_sent"], true);
    assert_eq!(
        released_data[0]["released_to"],
        json!(["sam@qa.example.test"])
    );
    assert_eq!(released_data[1]["is_sent"], false);
}
