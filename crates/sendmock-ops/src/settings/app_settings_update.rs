use schemars::JsonSchema;
use serde::Deserialize;

use super::app_settings::AppSettings;
use super::setting_choices::{
    EmailOutcomeProfile, OpenedEventMode, PaymentOutcomeProfile, SmsSimulationProfile,
    UpdateCheckMode,
};
use crate::present_value::read_present_value;

/// Only the changed keys; every other setting keeps its value.
#[derive(Debug, Clone, Default, Deserialize, JsonSchema)]
#[serde(deny_unknown_fields)]
pub struct AppSettingsUpdate {
    /// The most emails kept; the oldest are deleted past it.
    pub max_emails: Option<u64>,
    /// The most SMS kept; the oldest are deleted past it.
    pub max_sms: Option<u64>,
    /// Null keeps traffic until the count limits prune it.
    #[serde(default, deserialize_with = "read_present_value")]
    #[schemars(with = "Option<u32>")]
    pub max_age_days: Option<Option<u32>>,
    /// Tags `user+invoice@app.test` with `invoice`.
    pub is_plus_address_tagging_enabled: Option<bool>,
    pub email_outcome_profile: Option<EmailOutcomeProfile>,
    /// Used by the `realistic` outcome profile.
    pub email_outcome_bounce_rate_percent: Option<u32>,
    /// Complaints in the `realistic` outcome profile, 0 to 100.
    pub email_outcome_complaint_rate_percent: Option<u32>,
    /// Relay for release and auto-forward; the password is always masked.
    #[serde(default, deserialize_with = "read_present_value")]
    #[schemars(with = "Option<String>")]
    pub relay_smtp_url: Option<Option<String>>,
    /// Glob patterns; release stays off while this is empty.
    pub relay_recipient_allowlist: Option<Vec<String>>,
    /// `host:port` of a SpamAssassin `spamd`; null turns the spam check off.
    #[serde(default, deserialize_with = "read_present_value")]
    #[schemars(with = "Option<String>")]
    pub spamassassin_address: Option<Option<String>>,
    pub sms_simulation_profile: Option<SmsSimulationProfile>,
    /// The share of SMS that fail at random, 0 to 100.
    pub sms_failure_rate_percent: Option<u32>,
    /// Rejects numbers that are not Twilio test numbers with error 21606, like real test credentials.
    pub is_strict_twilio_test_mode: Option<bool>,
    /// Off: the built-in Twilio and SendMock numbers behave like any number.
    pub is_magic_numbers_enabled: Option<bool>,
    /// Off: the built-in magic addresses behave like any address.
    pub is_magic_addresses_enabled: Option<bool>,
    /// Fires `email.opened` and `sms.opened` when you open a message in the UI.
    pub fire_opened_events_on_view: Option<bool>,
    pub opened_event_mode: Option<OpenedEventMode>,
    /// Rejects the next N SMTP messages, to test your app's retries.
    pub chaos_smtp_reject_next_count: Option<u32>,
    /// The SMTP code used for rejected messages: 421, 450, 550 or 552.
    pub chaos_smtp_reject_code: Option<u16>,
    /// Glob; matching recipients get `550 No such user`.
    #[serde(default, deserialize_with = "read_present_value")]
    #[schemars(with = "Option<String>")]
    pub chaos_smtp_reject_recipient_pattern: Option<Option<String>>,
    /// Delay added to every SMTP command, in milliseconds.
    pub chaos_smtp_command_latency_ms: Option<u32>,
    /// Drops the connection during `DATA`, to test half-sent messages.
    pub is_chaos_smtp_drop_during_data_enabled: Option<bool>,
    /// Ordered; the first capture group of the first match is the code.
    pub otp_patterns: Option<Vec<String>>,
    pub update_check_mode: Option<UpdateCheckMode>,
    /// Mail for these domains is incoming; offered as Forward suggestions.
    pub inbound_email_domains: Option<Vec<String>>,
    /// Shown on checkout pages and as `{merchant}` in step labels.
    pub payment_merchant_name: Option<String>,
    /// For hosted checkouts created without a currency.
    pub payment_default_currency: Option<String>,
    pub payment_outcome_profile: Option<PaymentOutcomeProfile>,
    /// Used by the `random` outcome profile.
    pub payment_random_success_rate_percent: Option<u32>,
}

/// Copies each named field from the update when it carries one.
macro_rules! copy_present_fields {
    ($update:ident => $settings:ident: $($field_name:ident),+ $(,)?) => {
        $(
            if let Some(new_value) = $update.$field_name {
                $settings.$field_name = new_value;
            }
        )+
    };
}

impl AppSettingsUpdate {
    /// The settings with this update applied; a masked relay password keeps the stored one.
    pub fn apply_to(self, mut settings: AppSettings) -> AppSettings {
        let stored_relay_url = settings.relay_smtp_url.clone();
        let update = self;
        copy_present_fields!(update => settings:
            max_emails,
            max_sms,
            max_age_days,
            is_plus_address_tagging_enabled,
            email_outcome_profile,
            email_outcome_bounce_rate_percent,
            email_outcome_complaint_rate_percent,
            relay_smtp_url,
            relay_recipient_allowlist,
            spamassassin_address,
            sms_simulation_profile,
            sms_failure_rate_percent,
            is_strict_twilio_test_mode,
            is_magic_numbers_enabled,
            is_magic_addresses_enabled,
            fire_opened_events_on_view,
            opened_event_mode,
            chaos_smtp_reject_next_count,
            chaos_smtp_reject_code,
            chaos_smtp_reject_recipient_pattern,
            chaos_smtp_command_latency_ms,
            is_chaos_smtp_drop_during_data_enabled,
            otp_patterns,
            update_check_mode,
            inbound_email_domains,
            payment_merchant_name,
            payment_default_currency,
            payment_outcome_profile,
            payment_random_success_rate_percent,
        );
        settings.relay_smtp_url = keep_stored_password(settings.relay_smtp_url, stored_relay_url);
        settings
    }
}

/// The UI sends the relay URL back as it got it, with the password masked.
fn keep_stored_password(
    new_relay_url: Option<String>,
    stored_relay_url: Option<String>,
) -> Option<String> {
    match (new_relay_url, stored_relay_url) {
        (Some(new_relay_url), Some(stored_relay_url))
            if new_relay_url.contains(super::app_settings::MASKED_PASSWORD)
                && super::app_settings::mask_url_password(&stored_relay_url) == new_relay_url =>
        {
            Some(stored_relay_url)
        }
        (new_relay_url, _) => new_relay_url,
    }
}
