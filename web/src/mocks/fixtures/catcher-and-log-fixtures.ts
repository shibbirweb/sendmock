import type {
  ApiRequestLogEntry,
  AppSettings,
  CapturedHttpRequest,
  HttpBin,
  SmtpSession,
} from "@/lib/api/types";
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

const successfulTranscript = [
  "S: 220 sendmock ESMTP ready",
  "C: EHLO laravel.local",
  "S: 250-sendmock Hello laravel.local",
  "S: 250-PIPELINING",
  "S: 250-SIZE 26214400",
  "S: 250-STARTTLS",
  "S: 250 AUTH PLAIN LOGIN CRAM-MD5",
  "C: AUTH PLAIN ••••••••",
  "S: 235 2.7.0 Authentication successful",
  "C: MAIL FROM:<no-reply@acme.test>",
  "S: 250 2.1.0 OK",
  "C: RCPT TO:<rahim@example.com>",
  "S: 250 2.1.5 OK",
  "C: DATA",
  "S: 354 End data with <CR><LF>.<CR><LF>",
  "C: [message 2,148 bytes, stored as email]",
  "S: 250 2.0.0 Queued",
  "C: QUIT",
  "S: 221 2.0.0 Bye",
].join("\n");

const failedAuthTranscript = [
  "S: 220 sendmock ESMTP ready",
  "C: EHLO worker-3",
  "S: 250-sendmock Hello worker-3",
  "S: 250 AUTH PLAIN LOGIN",
  "C: AUTH LOGIN",
  "S: 334 VXNlcm5hbWU6",
  "C: ••••••••",
  "S: 334 UGFzc3dvcmQ6",
  "C: ••••••••",
  "S: 535 5.7.8 Authentication credentials invalid",
  "C: QUIT",
  "S: 221 2.0.0 Bye",
].join("\n");

export function buildSmtpSessionFixtures(): SmtpSession[] {
  return [
    {
      id: createMockUlid(minutesAgoInMs(1)),
      remote_address: "127.0.0.1:53122",
      helo_name: "laravel.local",
      tls_version: "TLS 1.3",
      auth_mechanism: "PLAIN",
      auth_user: "laravel",
      result: "delivered",
      failure_reason: null,
      email_ids: [],
      transcript: successfulTranscript,
      started_at: minutesAgo(1),
      ended_at: minutesAgo(0.99),
    },
    {
      id: createMockUlid(minutesAgoInMs(17)),
      remote_address: "172.18.0.5:40112",
      helo_name: "worker-3",
      tls_version: null,
      auth_mechanism: "LOGIN",
      auth_user: "worker",
      result: "rejected",
      failure_reason: "535 Authentication credentials invalid",
      email_ids: [],
      transcript: failedAuthTranscript,
      started_at: minutesAgo(17),
      ended_at: minutesAgo(16.99),
    },
  ];
}

export function buildApiRequestLogFixtures(): ApiRequestLogEntry[] {
  return [
    {
      id: createMockUlid(minutesAgoInMs(0.5)),
      api: "twilio",
      method: "POST",
      path: "/2010-04-01/Accounts/AC00000000000000000000000000000000/Messages.json",
      request_headers: { authorization: "Basic ••••••••" },
      request_body:
        "To=%2B8801700000000&From=%2B15550001111&Body=Your+Acme+verification+code+is+482913",
      response_status: 201,
      response_body: '{"sid":"SM...","status":"queued"}',
      duration_ms: 3,
      message_id: null,
      created_at: minutesAgo(0.5),
    },
    {
      id: createMockUlid(minutesAgoInMs(11)),
      api: "twilio",
      method: "POST",
      path: "/2010-04-01/Accounts/AC00000000000000000000000000000000/Messages.json",
      request_headers: { authorization: "Basic ••••••••" },
      request_body: "To=%2B15005550001&From=%2B15550001111&Body=Hello",
      response_status: 400,
      response_body:
        '{"code":21211,"message":"The \'To\' number +15005550001 is not a valid phone number.","status":400}',
      duration_ms: 1,
      message_id: null,
      created_at: minutesAgo(11),
    },
  ];
}

export function buildDefaultSettings(): AppSettings {
  return {
    max_emails: 1000,
    max_sms: 1000,
    max_age_days: null,
    is_plus_address_tagging_enabled: true,
    email_outcome_profile: "off",
    sms_simulation_profile: "realistic",
    sms_failure_rate_percent: 0,
    is_strict_twilio_test_mode: false,
    fire_opened_events_on_view: true,
    opened_event_mode: "first_open",
    otp_patterns: ["(?:code|otp|verification)[^0-9]{0,40}(\\d{4,8})"],
  };
}
