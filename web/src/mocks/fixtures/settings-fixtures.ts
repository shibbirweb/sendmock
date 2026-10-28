import type { AppSettings } from "@/lib/api/types";
import { defaultOtpPatterns } from "@/lib/settings/default-otp-patterns";

export function buildDefaultSettings(): AppSettings {
  return {
    max_emails: 1000,
    max_sms: 1000,
    max_age_days: null,
    is_plus_address_tagging_enabled: true,
    email_outcome_profile: "off",
    email_outcome_bounce_rate_percent: 5,
    email_outcome_complaint_rate_percent: 1,
    relay_smtp_url: null,
    relay_recipient_allowlist: [],
    spamassassin_address: null,
    sms_simulation_profile: "realistic",
    sms_failure_rate_percent: 0,
    inbound_email_domains: ["inbound.app.test", "reply.app.test"],
    is_strict_twilio_test_mode: false,
    is_magic_numbers_enabled: true,
    is_magic_addresses_enabled: true,
    fire_opened_events_on_view: true,
    opened_event_mode: "first_open",
    chaos_smtp_reject_next_count: 0,
    chaos_smtp_reject_code: 550,
    chaos_smtp_reject_recipient_pattern: null,
    chaos_smtp_command_latency_ms: 0,
    is_chaos_smtp_drop_during_data_enabled: false,
    otp_patterns: [...defaultOtpPatterns],
    update_check_mode: "off",
    payment_merchant_name: "Acme Shop",
    payment_default_currency: "USD",
    payment_outcome_profile: "interactive",
    payment_random_success_rate_percent: 80,
  };
}
