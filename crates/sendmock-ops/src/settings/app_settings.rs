use schemars::JsonSchema;
use sendmock_mail::DEFAULT_OTP_PATTERNS;
use serde::{Deserialize, Serialize};

use super::setting_choices::{
    EmailOutcomeProfile, OpenedEventMode, PaymentOutcomeProfile, SmsSimulationProfile,
    UpdateCheckMode,
};

/// Every runtime setting. Settings for later phases are kept until their feature reads them.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, JsonSchema)]
pub struct AppSettings {
    /// The most emails kept; the oldest are deleted past it.
    pub max_emails: u64,
    /// The most SMS kept; the oldest are deleted past it.
    pub max_sms: u64,
    /// Null keeps traffic until the count limits prune it.
    #[schemars(required)]
    pub max_age_days: Option<u32>,
    /// Tags `user+invoice@app.test` with `invoice`.
    pub is_plus_address_tagging_enabled: bool,
    pub email_outcome_profile: EmailOutcomeProfile,
    /// Used by the `realistic` outcome profile.
    pub email_outcome_bounce_rate_percent: u32,
    /// Complaints in the `realistic` outcome profile, 0 to 100.
    pub email_outcome_complaint_rate_percent: u32,
    /// Relay for release and auto-forward; the password is always masked.
    #[schemars(required)]
    pub relay_smtp_url: Option<String>,
    /// Glob patterns; release stays off while this is empty.
    pub relay_recipient_allowlist: Vec<String>,
    /// `host:port` of a SpamAssassin `spamd`; null turns the spam check off.
    #[schemars(required)]
    pub spamassassin_address: Option<String>,
    pub sms_simulation_profile: SmsSimulationProfile,
    /// The share of SMS that fail at random, 0 to 100.
    pub sms_failure_rate_percent: u32,
    /// Rejects numbers that are not Twilio test numbers with error 21606, like real test credentials.
    pub is_strict_twilio_test_mode: bool,
    /// Off: the built-in Twilio and SendMock numbers behave like any number.
    pub is_magic_numbers_enabled: bool,
    /// Off: the built-in magic addresses behave like any address.
    pub is_magic_addresses_enabled: bool,
    /// Fires `email.opened` and `sms.opened` when you open a message in the UI.
    pub fire_opened_events_on_view: bool,
    pub opened_event_mode: OpenedEventMode,
    /// Rejects the next N SMTP messages, to test your app's retries.
    pub chaos_smtp_reject_next_count: u32,
    /// The SMTP code used for rejected messages: 421, 450, 550 or 552.
    pub chaos_smtp_reject_code: u16,
    /// Glob; matching recipients get `550 No such user`.
    #[schemars(required)]
    pub chaos_smtp_reject_recipient_pattern: Option<String>,
    /// Delay added to every SMTP command, in milliseconds.
    pub chaos_smtp_command_latency_ms: u32,
    /// Drops the connection during `DATA`, to test half-sent messages.
    pub is_chaos_smtp_drop_during_data_enabled: bool,
    /// Ordered; the first capture group of the first match is the code.
    pub otp_patterns: Vec<String>,
    pub update_check_mode: UpdateCheckMode,
    /// Mail for these domains is incoming; offered as Forward suggestions.
    pub inbound_email_domains: Vec<String>,
    /// Shown on checkout pages and as `{merchant}` in step labels.
    pub payment_merchant_name: String,
    /// For hosted checkouts created without a currency.
    pub payment_default_currency: String,
    pub payment_outcome_profile: PaymentOutcomeProfile,
    /// Used by the `random` outcome profile.
    pub payment_random_success_rate_percent: u32,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            max_emails: 1000,
            max_sms: 1000,
            max_age_days: None,
            is_plus_address_tagging_enabled: true,
            email_outcome_profile: EmailOutcomeProfile::Off,
            email_outcome_bounce_rate_percent: 5,
            email_outcome_complaint_rate_percent: 1,
            relay_smtp_url: None,
            relay_recipient_allowlist: Vec::new(),
            spamassassin_address: None,
            sms_simulation_profile: SmsSimulationProfile::Realistic,
            sms_failure_rate_percent: 0,
            is_strict_twilio_test_mode: false,
            is_magic_numbers_enabled: true,
            is_magic_addresses_enabled: true,
            fire_opened_events_on_view: true,
            opened_event_mode: OpenedEventMode::FirstOpen,
            chaos_smtp_reject_next_count: 0,
            chaos_smtp_reject_code: 550,
            chaos_smtp_reject_recipient_pattern: None,
            chaos_smtp_command_latency_ms: 0,
            is_chaos_smtp_drop_during_data_enabled: false,
            otp_patterns: DEFAULT_OTP_PATTERNS
                .iter()
                .map(|pattern| (*pattern).to_owned())
                .collect(),
            update_check_mode: UpdateCheckMode::Off,
            inbound_email_domains: Vec::new(),
            payment_merchant_name: "Acme Shop".to_owned(),
            payment_default_currency: "USD".to_owned(),
            payment_outcome_profile: PaymentOutcomeProfile::Interactive,
            payment_random_success_rate_percent: 80,
        }
    }
}

impl AppSettings {
    /// Stored settings over the defaults, so a key an older version did not store takes its
    /// default and a key it no longer knows is dropped.
    pub fn from_stored_json(stored_json: &str) -> Self {
        let Ok(serde_json::Value::Object(stored_values)) = serde_json::from_str(stored_json) else {
            return Self::default();
        };
        let mut merged_values = match serde_json::to_value(Self::default()) {
            Ok(serde_json::Value::Object(default_values)) => default_values,
            _ => return Self::default(),
        };
        for (setting_key, stored_value) in stored_values {
            if merged_values.contains_key(&setting_key) {
                merged_values.insert(setting_key, stored_value);
            }
        }
        serde_json::from_value(serde_json::Value::Object(merged_values)).unwrap_or_default()
    }

    /// The relay URL with its password replaced, for every answer that leaves the server.
    pub fn with_masked_secrets(mut self) -> Self {
        self.relay_smtp_url = self
            .relay_smtp_url
            .map(|relay_url| mask_url_password(&relay_url));
        self
    }
}

pub const MASKED_PASSWORD: &str = "********";

/// `smtp://user:secret@host` becomes `smtp://user:********@host`.
pub fn mask_url_password(relay_url: &str) -> String {
    let Some((scheme, rest)) = relay_url.split_once("://") else {
        return relay_url.to_owned();
    };
    let Some((user_info, host_part)) = rest.rsplit_once('@') else {
        return relay_url.to_owned();
    };
    match user_info.split_once(':') {
        Some((user_name, _)) => format!("{scheme}://{user_name}:{MASKED_PASSWORD}@{host_part}"),
        None => relay_url.to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stored_settings_keep_their_values_and_fill_in_new_keys() {
        let restored = AppSettings::from_stored_json(r#"{"max_emails": 42, "retired_key": true}"#);

        assert_eq!(restored.max_emails, 42);
        assert_eq!(restored.max_sms, AppSettings::default().max_sms);
    }

    #[test]
    fn unreadable_stored_settings_fall_back_to_the_defaults() {
        assert_eq!(
            AppSettings::from_stored_json("not json"),
            AppSettings::default()
        );
        assert_eq!(
            AppSettings::from_stored_json(r#"{"max_emails": "many"}"#),
            AppSettings::default()
        );
    }

    #[test]
    fn masks_the_relay_password() {
        assert_eq!(
            mask_url_password("smtps://mailer:s3cret@relay.test:465"),
            "smtps://mailer:********@relay.test:465"
        );
        assert_eq!(
            mask_url_password("smtp://relay.test:25"),
            "smtp://relay.test:25"
        );
    }
}
