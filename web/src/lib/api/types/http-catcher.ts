import type { IsoTimestamp, Ulid } from "@/lib/api/types/common";
import type { HttpMethod, RuleFilter } from "@/lib/api/types/webhooks";

/** Ready-made bins whose replies mimic the real service (HC-03). */
export type HttpBinPreset =
  | "slack"
  | "discord"
  | "teams"
  | "google_chat"
  | "telegram"
  | "fcm"
  | "expo"
  | "onesignal"
  | "generic";

/** A reply SendMock sends; headers and body are templates. */
export type HttpMockResponse = {
  status_code: number;
  headers: Record<string, string>;
  body: string;
};

export type HttpBin = {
  id: Ulid;
  name: string;
  preset: HttpBinPreset | null;
  request_count: number;
  last_request_at: IsoTimestamp | null;
  /** Sent when no rule matches; `200 {"ok":true}` unless a preset sets another. */
  default_response: HttpMockResponse;
};

/** Body of POST /api/v1/http/bins. */
export type HttpBinInput = {
  name: string;
  preset: HttpBinPreset | null;
};

/** One mock response rule; rules are checked in order and the first match answers (HC-02.1). */
export type HttpResponseRule = {
  /** Empty for a new rule in a PUT; the API assigns it. */
  id: Ulid;
  name: string;
  is_enabled: boolean;
  /** Null matches any method. */
  method: HttpMethod | null;
  /** Relative to the bin, e.g. `/v1/*`; empty matches any path. */
  path_glob: string;
  /** Header and body conditions, as in webhook rules. */
  filter: RuleFilter | null;
  response: HttpMockResponse;
  /** A fixed delay when both are equal, else a random one in the range (HC-02.3). */
  delay_min_ms: number;
  delay_max_ms: number;
  failure_rate_percent: number;
  failure_status_code: number;
};

/** Body of POST /api/v1/http/bins/{binId}/responses/preview (HC-02.4). */
export type HttpRulePreviewRequest = {
  rule: HttpResponseRule;
  request_id: Ulid;
};

export type HttpRulePreviewResult = {
  is_match: boolean;
  /** Why the rule does not match, e.g. "Method is GET, not POST". */
  mismatch_reason: string | null;
  response: HttpMockResponse;
  problems: string[];
};

/** A file uploaded in a multipart request (HC-01.2). */
export type CapturedHttpFile = {
  file_index: number;
  field_name: string;
  filename: string;
  content_type: string;
  size_bytes: number;
};

export type CapturedHttpRequest = {
  id: Ulid;
  bin_id: Ulid;
  bin_name: string;
  method: string;
  /** Full URL as received, query included. */
  url: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>;
  body: string;
  content_type: string | null;
  files: CapturedHttpFile[];
  client_ip: string;
  response_status: number;
  response_headers: Record<string, string>;
  response_body: string;
  /** The rule that answered; null for the default reply. */
  matched_rule_id: Ulid | null;
  matched_rule_name: string | null;
  is_simulated_failure: boolean;
  duration_ms: number;
  created_at: IsoTimestamp;
};

/** Body of POST /api/v1/http/requests/{requestId}/forward (HC-01.5). */
export type HttpForwardRequest = { url: string };

export type HttpForwardResult = {
  status_code: number;
  duration_ms: number;
  body: string;
};

/** Body of `PATCH /http/bins/{binId}`. */
export type HttpBinUpdate = {
  default_response: HttpMockResponse;
};
