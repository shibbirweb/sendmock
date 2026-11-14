/// An email stored from a provider's HTTP API, as the provider knows it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EmailProviderSendRecord {
    pub email_id: String,
    pub provider_key: String,
    /// The id the provider's answer gave, such as SendGrid's `X-Message-Id`.
    pub provider_message_id: String,
    pub template_id: Option<String>,
    /// The template's data as JSON.
    pub template_data_json: Option<String>,
}
