import type { IsoTimestamp, PageRequest, Ulid } from "@/lib/api/types/common";

export type HttpBin = {
  id: Ulid;
  name: string;
  preset: string | null;
  request_count: number;
  last_request_at: IsoTimestamp | null;
};

export type CapturedHttpRequest = {
  id: Ulid;
  bin_id: Ulid;
  bin_name: string;
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  content_type: string | null;
  response_status: number;
  response_body: string;
  duration_ms: number;
  created_at: IsoTimestamp;
};

export type SmtpSessionResult = "delivered" | "rejected" | "aborted";

/** Query of GET /api/v1/logs/smtp; `result` takes a comma-separated list. */
export type SmtpSessionListFilters = PageRequest & {
  result?: string;
  query?: string;
};

export type SmtpSession = {
  id: Ulid;
  remote_address: string;
  helo_name: string;
  tls_version: string | null;
  auth_mechanism: string | null;
  auth_user: string | null;
  result: SmtpSessionResult;
  failure_reason: string | null;
  email_ids: Ulid[];
  /** One line per command or reply, prefixed `C: ` (client) or `S: ` (server). */
  transcript: string;
  started_at: IsoTimestamp;
  ended_at: IsoTimestamp;
};

export type ApiRequestLogEntry = {
  id: Ulid;
  api: string;
  method: string;
  path: string;
  request_headers: Record<string, string>;
  request_body: string;
  response_status: number;
  response_body: string;
  duration_ms: number;
  /** The SMS or email this request created; null for rejected requests. */
  linked_message: ApiRequestLinkedMessage | null;
  created_at: IsoTimestamp;
};

export type ApiRequestLinkedMessage = {
  kind: "email" | "sms";
  id: Ulid;
  /** Conversation of a linked SMS, for the "Open message" link. */
  sms_thread_id: string | null;
};

export type ApiStatusClass = "2xx" | "4xx" | "5xx";

/** Query of GET /api/v1/logs/http. */
export type ApiRequestLogFilters = PageRequest & {
  api?: string;
  status_class?: ApiStatusClass;
  path?: string;
};

export type AppStats = {
  email_count: number;
  unread_email_count: number;
  sms_count: number;
  unread_sms_count: number;
  verification_count: number;
  http_request_count: number;
  webhook_delivery_count: number;
  webhook_success_rate: number | null;
  webhook_p95_latency_ms: number | null;
  recent_failed_delivery_ids: Ulid[];
};

export type AppInfo = {
  version: string;
  channel: "stable" | "beta" | "edge" | "dev";
  uptime_seconds: number;
  smtp_address: string;
  http_address: string;
  provider_address: string | null;
  database_path: string;
  database_size_bytes: number;
};

export type SmsSimulationProfile = "instant" | "realistic" | "manual";
export type EmailOutcomeProfile = "off" | "auto-delivered" | "realistic";

export type AppSettings = {
  max_emails: number;
  max_sms: number;
  max_age_days: number | null;
  is_plus_address_tagging_enabled: boolean;
  email_outcome_profile: EmailOutcomeProfile;
  sms_simulation_profile: SmsSimulationProfile;
  sms_failure_rate_percent: number;
  is_strict_twilio_test_mode: boolean;
  fire_opened_events_on_view: boolean;
  opened_event_mode: "first_open" | "every_open";
  otp_patterns: string[];
  /** Mail for these domains is incoming; offered as Forward suggestions. */
  inbound_email_domains: string[];
};
