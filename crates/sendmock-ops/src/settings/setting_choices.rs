use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

/// `off` sends no delivery events, `auto-delivered` marks every email delivered after a
/// short delay, `realistic` adds bounces and complaints at the configured rates.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, JsonSchema)]
pub enum EmailOutcomeProfile {
    #[default]
    #[serde(rename = "off")]
    Off,
    #[serde(rename = "auto-delivered")]
    AutoDelivered,
    #[serde(rename = "realistic")]
    Realistic,
}

impl EmailOutcomeProfile {
    /// The name Settings and the API use.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Off => "off",
            Self::AutoDelivered => "auto-delivered",
            Self::Realistic => "realistic",
        }
    }
}

/// `instant` delivers at once, `realistic` goes queued, sent, then delivered over a few
/// seconds, `manual` stays sent until a status is picked.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum SmsSimulationProfile {
    Instant,
    #[default]
    Realistic,
    Manual,
}

/// `first_open` fires on the first view only, `every_open` on each view.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum OpenedEventMode {
    #[default]
    FirstOpen,
    EveryOpen,
}

/// When SendMock looks for a newer release: `off` never calls out, `manual` only on
/// request, `daily` on start and once a day.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum UpdateCheckMode {
    #[default]
    Off,
    Manual,
    Daily,
}

/// What a new hosted checkout does: wait for the page, or settle at once.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum PaymentOutcomeProfile {
    #[default]
    Interactive,
    AutoSuccess,
    AutoDecline,
    Random,
}

/// SMTP reply codes the chaos options can answer with.
pub const CHAOS_SMTP_REJECT_CODES: [u16; 4] = [421, 450, 550, 552];
