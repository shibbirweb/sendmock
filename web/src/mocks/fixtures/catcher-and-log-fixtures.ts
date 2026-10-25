import type {
  AppSettings,
  CapturedHttpRequest,
  HttpBin,
} from "@/lib/api/types";
import { defaultOtpPatterns } from "@/lib/settings/default-otp-patterns";
import {
  createMockUlid,
  minutesAgo,
  minutesAgoInMs,
} from "@/mocks/fixtures/fixture-helpers";

export function buildHttpBinFixtures(): HttpBin[] {
  return [
    {
      id: createMockUlid(),
      name: "slack",
      preset: "slack",
      request_count: 2,
      last_request_at: minutesAgo(16),
    },
    {
      id: createMockUlid(),
      name: "push",
      preset: "fcm",
      request_count: 1,
      last_request_at: minutesAgo(26),
    },
    {
      id: createMockUlid(),
      name: "analytics",
      preset: null,
      request_count: 1,
      last_request_at: minutesAgo(41),
    },
  ];
}

export function buildCapturedHttpRequestFixtures(
  httpBins: HttpBin[],
): CapturedHttpRequest[] {
  const [slackBin, pushBin, analyticsBin] = httpBins;
  const requestSpecs = [
    {
      bin: slackBin,
      minutesAgo: 16,
      path: "/catch/slack",
      body: '{"text":"Email bounced: unknown-user@example.com"}',
      responseBody: "ok",
    },
    {
      bin: slackBin,
      minutesAgo: 33,
      path: "/catch/slack",
      body: '{"text":"SendMock test ping"}',
      responseBody: "ok",
    },
    {
      bin: pushBin,
      minutesAgo: 26,
      path: "/catch/push/v1/projects/acme/messages:send",
      body: '{"message":{"token":"device-token","notification":{"title":"Order shipped","body":"Your order #10293 is on the way"}}}',
      responseBody: '{"name":"projects/acme/messages/0:1729785600"}',
    },
    {
      bin: analyticsBin,
      minutesAgo: 41,
      path: "/catch/analytics/track",
      body: '{"event":"signup","user_id":42}',
      responseBody: '{"ok":true}',
    },
  ];

  return requestSpecs.map((requestSpec) => ({
    id: createMockUlid(minutesAgoInMs(requestSpec.minutesAgo)),
    bin_id: requestSpec.bin?.id ?? "",
    bin_name: requestSpec.bin?.name ?? "",
    method: "POST",
    path: requestSpec.path,
    query: {},
    headers: {
      "content-type": "application/json",
      "user-agent": "acme-app/1.0",
    },
    body: requestSpec.body,
    content_type: "application/json",
    response_status: 200,
    response_body: requestSpec.responseBody,
    duration_ms: 2,
    created_at: minutesAgo(requestSpec.minutesAgo),
  }));
}

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
    fire_opened_events_on_view: true,
    opened_event_mode: "first_open",
    chaos_smtp_reject_next_count: 0,
    chaos_smtp_reject_code: 550,
    chaos_smtp_reject_recipient_pattern: null,
    chaos_smtp_command_latency_ms: 0,
    is_chaos_smtp_drop_during_data_enabled: false,
    otp_patterns: [...defaultOtpPatterns],
    is_update_check_enabled: false,
  };
}
