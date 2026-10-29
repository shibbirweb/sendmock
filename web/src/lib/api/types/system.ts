import type { IsoTimestamp, PageRequest, Ulid } from "@/lib/api/types/common";
import type { AppEventType } from "@/lib/api/types/events";

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

/** One hour of traffic in the Overview activity chart. */
export type ActivityBucket = {
  bucket_start: IsoTimestamp;
  email_count: number;
  sms_count: number;
  http_request_count: number;
  webhook_delivery_count: number;
};

export type FailureCodeCount = {
  /** HTTP status as text (`"500"`), or `"timeout"` / `"connection"`. */
  failure_code: string;
  failure_count: number;
};

/** Webhook health of one endpoint over the last 24 hours (WH-11.1). */
export type EndpointMetrics = {
  endpoint_id: Ulid;
  endpoint_name: string;
  delivery_count: number;
  /** 0 to 1; null when nothing finished yet. */
  success_rate: number | null;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
  retry_count: number;
  top_failure_codes: FailureCodeCount[];
};

export type RecentFailedDelivery = {
  delivery_id: Ulid;
  endpoint_name: string;
  event_type: AppEventType;
  status_code: number | null;
  error_message: string | null;
  created_at: IsoTimestamp;
};

export type WebhookMetricsRange = "24h" | "7d";

/** One hour (24h) or day (7d) of deliveries by outcome (WH-11.3). */
export type DeliveryOutcomeBucket = {
  bucket_start: IsoTimestamp;
  succeeded_count: number;
  /** Pending, in flight, or failed with a retry still to come. */
  retrying_count: number;
  /** Exhausted, render failed, cancelled, or failed with no retry left. */
  failed_count: number;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
};

/** Query of GET /api/v1/webhooks/metrics. */
export type WebhookMetricsQuery = {
  range: WebhookMetricsRange;
  endpoint_id?: Ulid;
};

/** GET /api/v1/webhooks/metrics: delivery health for a range (WH-11.1, WH-11.3). */
export type WebhookMetrics = {
  range: WebhookMetricsRange;
  endpoint_id: Ulid | null;
  delivery_count: number;
  success_rate: number | null;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
  retry_count: number;
  render_failed_count: number;
  /** Oldest first, ending with the current hour or day. */
  buckets: DeliveryOutcomeBucket[];
  endpoint_metrics: EndpointMetrics[];
  top_failure_codes: FailureCodeCount[];
  recent_failures: RecentFailedDelivery[];
};

/** GET /api/v1/stats: everything the Overview shows (UI-03). */
export type AppStats = {
  email_count: number;
  emails_today: number;
  unread_email_count: number;
  sms_count: number;
  sms_today: number;
  unread_sms_count: number;
  verification_count: number;
  pending_verification_count: number;
  http_request_count: number;
  http_requests_today: number;
  webhook_delivery_count: number;
  webhook_success_rate: number | null;
  webhook_p95_latency_ms: number | null;
  payment_count: number;
  payments_today: number;
  /** Succeeded among finished payments; null before any finished. */
  payment_success_rate: number | null;
  /** Captured minus refunded, per currency, largest first (test money). */
  payment_revenue: { currency: string; amount_minor: number }[];
  /** 24 hourly buckets, oldest first, ending with the current hour. */
  activity: ActivityBucket[];
  endpoint_metrics: EndpointMetrics[];
  recent_failures: RecentFailedDelivery[];
};

/** The release line a build comes from; it decides which updates are offered. */
export type ReleaseChannel = "stable" | "beta" | "edge" | "dev";

export type AppInfo = {
  version: string;
  channel: ReleaseChannel;
  uptime_seconds: number;
  smtp_address: string;
  http_address: string;
  provider_address: string | null;
  database_path: string;
  database_size_bytes: number;
  /** True when SendMock runs in Docker, so the UI defaults to container hostnames. */
  is_container: boolean;
  /**
   * The `operationId`s this binary serves; the UI shows Not available yet for the
   * rest (UI-12).
   */
  available_operations: string[];
};

/** What `POST /api/v1/samples/{kind}` can create (UI-04.2). */
export type SampleKind = "email" | "sms" | "verification" | "http";

export type CreatedSample = {
  kind: SampleKind;
  /** Email or SMS ID, or the verification SID. */
  id: string;
};

export type SmsSimulationProfile = "instant" | "realistic" | "manual";
export type EmailOutcomeProfile = "off" | "auto-delivered" | "realistic";

/** SMTP reply codes the chaos options can answer with. */
export type ChaosSmtpRejectCode = 421 | 450 | 550 | 552;

export type AppSettings = {
  /**
   * The most emails kept; the oldest are deleted past it.
   * @example 1000
   */
  max_emails: number;
  /**
   * The most SMS kept; the oldest are deleted past it.
   * @example 1000
   */
  max_sms: number;
  /**
   * Null keeps traffic until the count limits prune it.
   * @example 7
   */
  max_age_days: number | null;
  /**
   * Tags `user+invoice@app.test` with `invoice`.
   * @example true
   */
  is_plus_address_tagging_enabled: boolean;
  /**
   * `off` sends no delivery events, `auto-delivered` marks every email delivered after a short delay, `realistic` adds bounces and complaints at the rates below.
   * @example "off"
   */
  email_outcome_profile: EmailOutcomeProfile;
  /**
   * Used by the `realistic` outcome profile.
   * @example 5
   */
  email_outcome_bounce_rate_percent: number;
  /**
   * Complaints in the `realistic` outcome profile, 0 to 100.
   * @example 1
   */
  email_outcome_complaint_rate_percent: number;
  /**
   * Relay for release and auto-forward; the password is always masked.
   * @example "smtp://user:pass@smtp.yourcompany.com:587"
   */
  relay_smtp_url: string | null;
  /**
   * Glob patterns; release stays off while this is empty.
   * @example ["*@yourcompany.com"]
   */
  relay_recipient_allowlist: string[];
  /**
   * `host:port` of a SpamAssassin `spamd`; null turns the spam check off.
   * @example "127.0.0.1:783"
   */
  spamassassin_address: string | null;
  /**
   * `instant` delivers at once, `realistic` goes queued, sent, then delivered over a few seconds, `manual` stays sent until you pick a status.
   * @example "instant"
   */
  sms_simulation_profile: SmsSimulationProfile;
  /**
   * The share of SMS that fail at random, 0 to 100.
   * @example 0
   */
  sms_failure_rate_percent: number;
  /**
   * Rejects numbers that are not Twilio test numbers with error 21606, like real test credentials.
   * @example false
   */
  is_strict_twilio_test_mode: boolean;
  /**
   * Off: the built-in Twilio and SendMock numbers behave like any number.
   * @example true
   */
  is_magic_numbers_enabled: boolean;
  /**
   * Off: the built-in magic addresses behave like any address.
   * @example true
   */
  is_magic_addresses_enabled: boolean;
  /**
   * Fires `email.opened` and `sms.opened` when you open a message in the UI.
   * @example true
   */
  fire_opened_events_on_view: boolean;
  /**
   * `first_open` fires on the first view only, `every_open` on each view.
   * @example "first_open"
   */
  opened_event_mode: "first_open" | "every_open";
  /**
   * Rejects the next N SMTP messages, to test your app's retries.
   * @example 0
   */
  chaos_smtp_reject_next_count: number;
  /**
   * The SMTP code used for rejected messages: 421, 450, 550 or 552.
   * @example 450
   */
  chaos_smtp_reject_code: ChaosSmtpRejectCode;
  /**
   * Glob; matching recipients get `550 No such user`.
   * @example "*@unknown.test"
   */
  chaos_smtp_reject_recipient_pattern: string | null;
  /**
   * Delay added to every SMTP command, in milliseconds.
   * @example 0
   */
  chaos_smtp_command_latency_ms: number;
  /**
   * Drops the connection during `DATA`, to test half-sent messages.
   * @example false
   */
  is_chaos_smtp_drop_during_data_enabled: boolean;
  /**
   * Ordered; the first capture group of the first match is the code.
   * @example ["code[:\\s]+(\\d{4,8})"]
   */
  otp_patterns: string[];
  /**
   * When SendMock looks for a newer release: `off` never calls out, `manual` only on request, `daily` on start and once a day.
   * @example "off"
   */
  update_check_mode: UpdateCheckMode;
  /**
   * Mail for these domains is incoming; offered as Forward suggestions.
   * @example ["reply.app.test"]
   */
  inbound_email_domains: string[];
  /**
   * Shown on checkout pages and as `{merchant}` in step labels.
   * @example "Demo Shop"
   */
  payment_merchant_name: string;
  /**
   * For hosted checkouts created without a currency.
   * @example "USD"
   */
  payment_default_currency: string;
  /**
   * What a new hosted checkout does: `interactive` waits for the page, `auto_success` and `auto_decline` settle at once, `random` succeeds at the rate below.
   * @example "interactive"
   */
  payment_outcome_profile: PaymentOutcomeProfile;
  /**
   * Used by the `random` outcome profile.
   * @example 80
   */
  payment_random_success_rate_percent: number;
};

/** What happens to a new hosted checkout (PY-09.4): wait for the page, or settle at once. */
export type PaymentOutcomeProfile =
  "interactive" | "auto_success" | "auto_decline" | "random";

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
  /**
   * The seed file's text (`sendmock.seed.toml`).
   * @example "[[numbers]]\nnumber = \"+15550001111\"\nlabel = \"Support line\""
   */
  seed_toml: string;
};

/** When the update check runs; `off` is the default. */
export type UpdateCheckMode = "off" | "manual" | "daily";

/** How SendMock was installed, baked in by each package; it picks the upgrade command. */
export type InstallMethod =
  "homebrew" | "scoop" | "docker" | "install_script" | "npm" | "unknown";

/** The newer release an update check offers. */
export type AvailableRelease = {
  /** @example "0.2.0-beta.1" */
  version: string;
  published_at: IsoTimestamp;
  /** The release's `CHANGELOG.md` section, in Markdown. */
  release_notes_markdown: string;
  /** @example "https://github.com/shibbirweb/sendmock/releases/tag/v0.2.0-beta.1" */
  release_url: string;
  /**
   * The command for the install method; null when the method is unknown, so follow `release_url`.
   * @example "brew upgrade sendmock"
   */
  upgrade_command: string | null;
};

/** GET /api/v1/updates: the result of the opt-in update check. */
export type UpdateCheckResult = {
  current_version: string;
  channel: ReleaseChannel;
  install_method: InstallMethod;
  /** False for edge and dev builds, which are offered no updates. */
  is_channel_checked: boolean;
  is_update_available: boolean;
  /** Null when up to date or when the channel is not checked. */
  available_release: AvailableRelease | null;
  checked_at: IsoTimestamp;
  /** True when the answer is the last check's, kept for 24 hours. */
  is_from_cache: boolean;
};

/** Answer of `GET /health`. */
export type HealthStatus = {
  status: "ok";
};
