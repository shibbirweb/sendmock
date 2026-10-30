use super::message_provider_definition::MessageProviderDefinition;

/// Exported from the mock's fixtures by `web/scripts/export-builtin-definitions.ts`, so the
/// UI and the binary ship the same definitions.
const BUILTIN_SMS_PROVIDERS_JSON: &str = include_str!("../../builtin/sms-providers.json");

/// The SMS providers SendMock ships, as their definitions say.
pub fn builtin_sms_providers() -> Vec<MessageProviderDefinition> {
    serde_json::from_str(BUILTIN_SMS_PROVIDERS_JSON).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_shipped_sms_providers_parse() {
        let provider_keys: Vec<String> = builtin_sms_providers()
            .into_iter()
            .map(|provider| provider.key)
            .collect();

        assert_eq!(
            provider_keys,
            vec!["twilio", "twilio_verify", "vonage", "plivo", "messagebird"]
        );
    }
}
