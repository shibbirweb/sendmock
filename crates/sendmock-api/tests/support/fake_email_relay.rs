use std::future::Future;
use std::pin::Pin;
use std::sync::Mutex;

use sendmock_ops::{EmailRelay, RelayMessage};

/// What the fake relay was handed for one message.
#[derive(Debug, Clone, PartialEq)]
pub struct RelayedMessage {
    pub relay_url: String,
    pub mail_from: String,
    pub recipients: Vec<String>,
    pub raw_message: String,
}

/// Takes every message, except one for `refused@qa.example.test`, as a relay that refuses it.
#[derive(Default)]
pub struct FakeRelay {
    relayed_messages: Mutex<Vec<RelayedMessage>>,
}

impl FakeRelay {
    pub fn read_relayed_messages(&self) -> Vec<RelayedMessage> {
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
