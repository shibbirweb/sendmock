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

/** SMTP reply codes the chaos options can answer with. */
export type ChaosSmtpRejectCode = 421 | 450 | 550 | 552;

export type AppSettings = {
  max_emails: number;
  max_sms: number;
  /** Null keeps traffic until the count limits prune it. */
  max_age_days: number | null;
  is_plus_address_tagging_enabled: boolean;
  email_outcome_profile: EmailOutcomeProfile;
  /** Used by the `realistic` outcome profile. */
  email_outcome_bounce_rate_percent: number;
  email_outcome_complaint_rate_percent: number;
  /** Relay for release and auto-forward; the password is always masked. */
  relay_smtp_url: string | null;
  /** Glob patterns; release stays off while this is empty. */
  relay_recipient_allowlist: string[];
  /** `host:port` of a SpamAssassin `spamd`; null turns the spam check off. */
  spamassassin_address: string | null;
  sms_simulation_profile: SmsSimulationProfile;
  sms_failure_rate_percent: number;
  is_strict_twilio_test_mode: boolean;
  fire_opened_events_on_view: boolean;
  opened_event_mode: "first_open" | "every_open";
  chaos_smtp_reject_next_count: number;
  chaos_smtp_reject_code: ChaosSmtpRejectCode;
  /** Glob; matching recipients get `550 No such user`. */
  chaos_smtp_reject_recipient_pattern: string | null;
  chaos_smtp_command_latency_ms: number;
  is_chaos_smtp_drop_during_data_enabled: boolean;
  /** Ordered; the first capture group of the first match is the code. */
  otp_patterns: string[];
  is_update_check_enabled: boolean;
  /** Mail for these domains is incoming; offered as Forward suggestions. */
  inbound_email_domains: string[];
};

/** Body of PATCH /api/v1/settings: only the changed keys. */
export type AppSettingsUpdate = Partial<AppSettings>;

export type SeedChangedItem = {
  /** What kind of item, e.g. "Virtual number" or "Webhook endpoint". */
  item_kind: string;
  item_name: string;
  change: "added" | "edited";
};

/** GET /api/v1/seed/status. */
export type SeedStatus = {
  source_path: string | null;
  applied_at: IsoTimestamp | null;
  /** Configuration added or edited since the seed was applied. */
  changed_items: SeedChangedItem[];
};

export type SeedValidationError = {
  line: number;
  message: string;
};

/** Result of POST /api/v1/seed/validate (and of apply when invalid). */
export type SeedValidation = {
  is_valid: boolean;
  errors: SeedValidationError[];
  /** How many items of each kind the file would create or update. */
  summary: { item_kind: string; item_count: number }[];
};

/** Body of POST /api/v1/seed/validate and /seed/apply. */
export type SeedFileRequest = {
  seed_toml: string;
};

/** GET /api/v1/updates (opt-in). */
export type UpdateCheckResult = {
  current_version: string;
  latest_version: string;
  is_update_available: boolean;
  release_url: string;
  checked_at: IsoTimestamp;
};
