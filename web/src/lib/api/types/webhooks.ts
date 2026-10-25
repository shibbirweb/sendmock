import type {
  CreatedBy,
  IsoTimestamp,
  PageRequest,
  Ulid,
} from "@/lib/api/types/common";
import type { AppEventType } from "@/lib/api/types/events";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RetryPolicy = {
  max_attempts: number;
  backoff_seconds: number[];
  retry_on_client_errors: boolean;
};

export type TemplateMode = "linked" | "detached";

export type WebhookEndpoint = {
  id: Ulid;
  name: string;
  url: string;
  method: HttpMethod;
  /** Extra headers layered on top of the template's. */
  headers: Record<string, string>;
  /** Extra body fields layered on top of the template's. */
  extra_fields: Record<string, string>;
  template_id: string;
  template_mode: TemplateMode;
  /** Always masked by the API, e.g. "whsec_••••3f9a". */
  masked_secret: string;
  /** Until when the secret before the last rotation still signs; null when none. */
  previous_secret_expires_at: IsoTimestamp | null;
  timeout_ms: number;
  retry_policy: RetryPolicy;
  is_enabled: boolean;
  /** Success rate over the last 24 hours; null without finished deliveries. */
  success_rate: number | null;
  delivery_count_24h: number;
  /** 24 hourly success rates, oldest first; null for hours without deliveries. */
  success_history: (number | null)[];
  created_by: CreatedBy;
  created_at: IsoTimestamp;
};

/** Body of POST and PATCH /api/v1/webhooks/endpoints. */
export type WebhookEndpointInput = Pick<
  WebhookEndpoint,
  | "name"
  | "url"
  | "method"
  | "headers"
  | "extra_fields"
  | "template_id"
  | "template_mode"
  | "timeout_ms"
  | "retry_policy"
  | "is_enabled"
>;

/** GET /api/v1/webhooks/endpoints/{endpointId}/secret (WH-01.3). */
export type RevealedEndpointSecret = {
  secret: string;
};

/** Body of POST /api/v1/webhooks/endpoints/{endpointId}/rotate-secret. */
export type RotateSecretRequest = {
  overlap_hours: number;
};

export type RuleFilterOperator =
  "equals" | "contains" | "starts_with" | "matches" | "regex" | "exists";

export type RuleCondition = {
  field: string;
  operator: RuleFilterOperator;
  value: string;
};

export type RuleFilter =
  | { all: RuleFilter[] }
  | { any: RuleFilter[] }
  | { not: RuleFilter }
  | RuleCondition;

export type WebhookRule = {
  id: Ulid;
  name: string;
  endpoint_id: Ulid;
  events: AppEventType[];
  filter: RuleFilter | null;
  is_enabled: boolean;
  order: number;
  created_by: CreatedBy;
};

/** Body of POST and PATCH /api/v1/webhooks/rules. */
export type WebhookRuleInput = Pick<
  WebhookRule,
  "name" | "endpoint_id" | "events" | "filter" | "is_enabled"
>;

/** Body of POST /api/v1/webhooks/rules/{ruleId}/move. */
export type WebhookRuleMove = { direction: "up" | "down" };

/** Body of POST /api/v1/webhooks/rules/preview (WH-02.3). */
export type RulePreviewRequest = {
  events: AppEventType[];
  filter: RuleFilter | null;
};

export type RulePreviewItem = {
  message_kind: "email" | "sms";
  message_id: Ulid;
  /** Subject, or the SMS body. */
  title: string;
  /** Sender address, or "+1555... to +1415...". */
  detail: string;
  created_at: IsoTimestamp;
  is_match: boolean;
};

export type RulePreviewResult = {
  checked_count: number;
  match_count: number;
  /** Newest first. */
  items: RulePreviewItem[];
};

export type DeliveryTrigger = "auto" | "manual" | "replay";
export type DeliveryStatus =
  | "pending"
  | "render_failed"
  | "in_flight"
  | "succeeded"
  | "failed"
  | "exhausted"
  | "cancelled";

export type RecordedHttpRequest = {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body: string;
};

export type RecordedHttpResponse = {
  status_code: number;
  headers: Record<string, string>;
  body: string;
  is_body_truncated: boolean;
};

export type WebhookDelivery = {
  id: Ulid;
  endpoint_id: Ulid;
  endpoint_name: string;
  rule_id: Ulid | null;
  event_id: string;
  event_type: AppEventType;
  subject_id: Ulid | null;
  trigger: DeliveryTrigger;
  attempt: number;
  status: DeliveryStatus;
  request: RecordedHttpRequest | null;
  response: RecordedHttpResponse | null;
  duration_ms: number | null;
  error_message: string | null;
  next_attempt_at: IsoTimestamp | null;
  created_at: IsoTimestamp;
};

/** Query of GET /api/v1/webhooks/deliveries; `status` takes a comma-separated list. */
export type DeliveryListFilters = PageRequest & {
  status?: string;
  endpoint_id?: string;
  event_type?: AppEventType;
};

/** One attempt of the same event, for the detail's attempt list. */
export type DeliveryAttemptSummary = {
  delivery_id: Ulid;
  attempt: number;
  status: DeliveryStatus;
  status_code: number | null;
  created_at: IsoTimestamp;
};

/** The email or SMS that caused a delivery. */
export type DeliverySubject = {
  kind: "email" | "sms";
  id: Ulid;
  /** Subject, or the SMS body. */
  title: string;
  sms_thread_id: string | null;
};

/** GET /api/v1/webhooks/deliveries/{deliveryId} (WH-03.8). */
export type WebhookDeliveryDetail = WebhookDelivery & {
  max_attempts: number;
  /** Every attempt of this event to this endpoint, oldest first. */
  attempts: DeliveryAttemptSummary[];
  subject: DeliverySubject | null;
};

/** Body of POST /api/v1/webhooks/deliveries/{deliveryId}/replay (WH-05.2). */
export type DeliveryReplayRequest = {
  rerender: boolean;
  /** An edited body and headers; left out to resend the stored request. */
  body?: string;
  headers?: Record<string, string>;
};

/** Body of POST /api/v1/webhooks/saved. */
export type SavedDeliveryInput = {
  name: string;
  delivery_id: Ulid;
};

/** Body of POST /api/v1/webhooks/saved/{savedId}/send (WH-10.2). */
export type SavedDeliverySendRequest = {
  endpoint_id: Ulid;
  rerender: boolean;
};

/** Body of PATCH /api/v1/webhooks/saved/{savedId}. */
export type SavedDeliveryRename = { name: string };

/** Body of POST /api/v1/webhooks/saved/{savedId}/template (WH-10.2). */
export type SaveAsTemplateRequest = { name: string };

export type VariableKind =
  | "text"
  | "number"
  | "boolean"
  | "json"
  | "secret"
  | "dynamic"
  | "random"
  | "computed"
  | "prompt";

export type WebhookVariable = {
  id: Ulid;
  name: string;
  kind: VariableKind;
  scope: "global" | "endpoint";
  endpoint_id: Ulid | null;
  /** Static value, expression, generator or default; secrets are masked. */
  value: string;
  random_mode: "per_send" | "fixed" | null;
  description: string;
  created_by: CreatedBy;
};

/** Body of POST and PATCH /api/v1/webhooks/variables. */
export type WebhookVariableInput = Pick<
  WebhookVariable,
  | "name"
  | "kind"
  | "scope"
  | "endpoint_id"
  | "value"
  | "random_mode"
  | "description"
>;

export type TemplateCategory =
  | "email-provider"
  | "sms-provider"
  | "chat"
  | "automation"
  | "generic"
  | "custom";

export type WebhookTemplateSummary = {
  id: string;
  name: string;
  service: string;
  category: TemplateCategory;
  source: "builtin" | "custom" | "file";
  events: AppEventType[];
  description: string;
  required_variables: string[];
  revision: number;
  /** A built-in template the user edited; Reset to default restores it (WH-09.8). */
  is_modified: boolean;
};

/** GET /api/v1/webhooks/templates/{templateId} (WH-08.4). */
export type WebhookTemplateDetail = WebhookTemplateSummary & {
  method: HttpMethod;
  content_type: string;
  /** Header name to a template, e.g. "X-Twilio-Signature": "{{ twilio_signature(...) }}". */
  header_templates: Record<string, string>;
  body_template: string;
  doc_url: string | null;
  /** "2026-09-30": when a provider template was last checked against the docs. */
  verified_on: string | null;
  used_by_endpoint_count: number;
};

/** The editable part of a template; body of PATCH /api/v1/webhooks/templates/{templateId}. */
export type TemplateDraft = Pick<
  WebhookTemplateDetail,
  "method" | "content_type" | "header_templates" | "body_template"
>;

/** Body of POST /api/v1/webhooks/templates/{templateId}/render; empty for the sample. */
export type TemplateRenderRequest = {
  email_id?: Ulid;
  sms_id?: Ulid;
  /** Unsaved edits to preview instead of the stored template (WH-09.7). */
  draft?: TemplateDraft;
};

export type TemplateRenderResult = {
  /** What it was rendered against, e.g. "Built-in sample" or an email subject. */
  rendered_against: string;
  headers: Record<string, string>;
  body: string;
  /** Undefined variables; they render empty. */
  warnings: string[];
  /** Problems that stop the template from being saved: unknown functions or filters, unbalanced braces. */
  errors: string[];
};

/** Body of POST /api/v1/webhooks/templates/{templateId}/clone. */
export type TemplateCloneRequest = { name: string };

export type SavedDelivery = {
  id: Ulid;
  name: string;
  endpoint_id: Ulid | null;
  /** The event of the delivery it was saved from; null for a composer request. */
  event_type: AppEventType | null;
  template_id: string;
  request: RecordedHttpRequest;
  saved_at: IsoTimestamp;
};
