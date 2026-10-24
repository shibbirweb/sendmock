import type { CreatedBy, IsoTimestamp, Ulid } from "@/lib/api/types/common";
import type { AppEventType } from "@/lib/api/types/events";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RetryPolicy = {
  max_attempts: number;
  backoff_seconds: number[];
  retry_on_client_errors: boolean;
};

export type WebhookEndpoint = {
  id: Ulid;
  name: string;
  url: string;
  method: HttpMethod;
  headers: Record<string, string>;
  template_id: string;
  template_mode: "linked" | "detached";
  /** Always masked by the API, e.g. "whsec_••••3f9a". */
  masked_secret: string;
  timeout_ms: number;
  retry_policy: RetryPolicy;
  is_enabled: boolean;
  success_rate: number | null;
  created_by: CreatedBy;
  created_at: IsoTimestamp;
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
};

export type SavedDelivery = {
  id: Ulid;
  name: string;
  endpoint_id: Ulid | null;
  template_id: string;
  request: RecordedHttpRequest;
  saved_at: IsoTimestamp;
};
