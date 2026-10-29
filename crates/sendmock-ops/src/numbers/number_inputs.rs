use schemars::JsonSchema;
use serde::Deserialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum NumberChannel {
    Sms,
    Whatsapp,
}

impl NumberChannel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Sms => "sms",
            Self::Whatsapp => "whatsapp",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, JsonSchema)]
pub enum InboundWebhookMethod {
    #[serde(rename = "POST")]
    Post,
    #[serde(rename = "GET")]
    Get,
}

impl InboundWebhookMethod {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Post => "POST",
            Self::Get => "GET",
        }
    }
}

/// What happens to inbound messages to a service's numbers.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum MessagingServiceInboundMode {
    Webhook,
    DeferToSender,
    Drop,
}

impl MessagingServiceInboundMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Webhook => "webhook",
            Self::DeferToSender => "defer_to_sender",
            Self::Drop => "drop",
        }
    }
}

/// Body of `POST` and `PATCH /api/v1/numbers`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct VirtualNumberInput {
    /// E.164, without a channel prefix; `channels` says whether WhatsApp works.
    pub number: String,
    /// A name for the number, e.g. the app or feature that uses it.
    pub label: String,
    /// Where the number works: `sms`, `whatsapp` or both.
    pub channels: Vec<NumberChannel>,
    /// Reply webhook (Twilio "A message comes in"); null means rules only.
    #[schemars(required)]
    pub inbound_url: Option<String>,
    /// The HTTP method of the reply webhook.
    pub inbound_method: InboundWebhookMethod,
    /// Called when the reply webhook fails, with `ErrorCode` and `ErrorUrl` added.
    #[schemars(required)]
    pub inbound_fallback_url: Option<String>,
    /// Payload template for the inbound webhook, e.g. `twilio.inbound_sms`.
    #[schemars(required)]
    pub inbound_template_id: Option<String>,
    /// Your app's URL for status changes of messages sent from this number.
    #[schemars(required)]
    pub status_callback_url: Option<String>,
    /// The Messaging Service this number belongs to, `MG...`; null for none.
    #[schemars(required)]
    pub messaging_service_sid: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct VirtualNumberUpdate {
    /// The number's ID, from `GET /api/v1/numbers`.
    pub number_id: String,
    #[serde(flatten)]
    pub changes: VirtualNumberInput,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct VirtualNumberReference {
    /// The number's ID, from `GET /api/v1/numbers`.
    pub number_id: String,
}

/// Body of `POST` and `PATCH /api/v1/messaging-services`.
#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct MessagingServiceInput {
    /// A name for the service.
    pub friendly_name: String,
    /// The virtual numbers in the sender pool, by ID.
    pub number_ids: Vec<String>,
    /// `webhook` (call `inbound_url`), `defer_to_sender` (each number's own webhook) or `drop`.
    pub inbound_mode: MessagingServiceInboundMode,
    /// Used when `inbound_mode` is `webhook`.
    #[schemars(required)]
    pub inbound_url: Option<String>,
    /// Called when `inbound_url` fails.
    #[schemars(required)]
    pub inbound_fallback_url: Option<String>,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct MessagingServiceUpdate {
    /// The service SID, `MG...`, from `GET /api/v1/messaging-services`.
    pub service_sid: String,
    #[serde(flatten)]
    pub changes: MessagingServiceInput,
}

#[derive(Debug, Clone, Deserialize, JsonSchema)]
pub struct MessagingServiceReference {
    /// The service SID, `MG...`, from `GET /api/v1/messaging-services`.
    pub service_sid: String,
}
