import type { CreatedBy, IsoTimestamp, Ulid } from "@/lib/api/types/common";
import type { AppEventType } from "@/lib/api/types/events";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type RetryPolicy = {
  /**
   * Attempts in total, the first one included.
   * @example 5
   */
  max_attempts: number;
  /**
   * Seconds to wait before each retry, in order; the last value repeats.
   * @example [1, 5, 30, 120, 600]
   */
  backoff_seconds: number[];
  /**
   * Also retry on 4xx answers; 5xx, timeouts and connection errors are always retried.
   * @example false
   */
  retry_on_client_errors: boolean;
};

export type TemplateMode = "linked" | "detached";

/** How an endpoint builds its body (WH-07.14). */
export type EndpointBodyMode = "template" | "fields" | "raw" | "none";
export type BodyFieldType = "text" | "number" | "boolean" | "json";
export type RenderMode = "strict" | "lenient";

/** A query param or header: a name and a template value. */
export type NameValueTemplate = {
  /**
   * The query parameter or header name.
   * @example "X-Source"
   */
  name: string;
  /**
   * The value, a template that can use the event and variables.
   * @example "sendmock-{{ event.type }}"
   */
  value: string;
};

/** One Fields-mode row; the value is a template, encoded as its type. */
export type EndpointBodyField = {
  /**
   * The field name; dots make nested keys (`user.email`).
   * @example "user.email"
   */
  name: string;
  /**
   * How the rendered value is encoded: `text`, `number`, `boolean` or `json`.
   * @example "text"
   */
  value_type: BodyFieldType;
  /**
   * The value, a template that can use the event and variables.
   * @example "{{ data.to[0].address }}"
   */
  value: string;
};

/** A render problem and where it comes from, e.g. "body" at line 3 (WH-07.15). */
export type RenderProblem = {
  message: string;
  severity: "error" | "warning";
  /** "url", "query.0", "header.0", "field.0" or "body". */
  source: string;
  line: number | null;
  column: number | null;
};

export type WebhookEndpoint = {
  id: Ulid;
  /**
   * A name for the endpoint, shown in lists and deliveries.
   * @example "Orders app"
   */
  name: string;
  /**
   * Where deliveries are sent; can use templates.
   * @example "http://localhost:3000/webhooks/sendmock"
   */
  url: string;
  /**
   * The HTTP method of each delivery.
   * @example "POST"
   */
  method: HttpMethod;
  /**
   * Extra headers layered on top of the template's.
   * @example {"Authorization": "Bearer {{ vars.app_token }}"}
   */
  headers: Record<string, string>;
  /**
   * Extra body fields layered on top of the template's.
   * @example {"environment": "local"}
   */
  extra_fields: Record<string, string>;
  /**
   * The payload template, e.g. `native` (Standard Webhooks JSON) or `slack.incoming_webhook`.
   * @example "native"
   */
  template_id: string;
  /**
   * `linked` follows template updates, `detached` keeps its own copy.
   * @example "linked"
   */
  template_mode: TemplateMode;
  /** Always masked by the API, e.g. "whsec_••••3f9a". */
  masked_secret: string;
  /** Until when the secret before the last rotation still signs; null when none. */
  previous_secret_expires_at: IsoTimestamp | null;
  /**
   * How long to wait for your app's answer, in milliseconds.
   * @example 10000
   */
  timeout_ms: number;
  /**
   * When and how often failed deliveries are retried.
   */
  retry_policy: RetryPolicy;
  /**
   * Off endpoints receive no deliveries.
   * @example true
   */
  is_enabled: boolean;
  /**
   * Query parameters added to the URL.
   */
  query_params: NameValueTemplate[];
  /**
   * How the body is built: `template` (the payload template), `fields` (name and value rows), `raw` (one text template) or `none`.
   * @example "template"
   */
  body_mode: EndpointBodyMode;
  /**
   * The rows of `fields` mode.
   */
  body_fields: EndpointBodyField[];
  /**
   * How `fields` mode is sent: `json` or `form` (`x-www-form-urlencoded`).
   * @example "json"
   */
  fields_encoding: "json" | "form";
  /**
   * The content type of `raw` mode.
   * @example "application/json"
   */
  raw_content_type: string;
  /**
   * The body template of `raw` mode.
   * @example "{\"text\": \"New email: {{ data.subject }}\"}"
   */
  raw_body: string;
  /**
   * `strict` stops a delivery on an undefined variable, `lenient` renders it empty with a warning.
   * @example "strict"
   */
  render_mode: RenderMode;
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
  | "query_params"
  | "body_mode"
  | "body_fields"
  | "fields_encoding"
  | "raw_content_type"
  | "raw_body"
  | "render_mode"
>;

/** Body of POST /api/v1/webhooks/endpoints/preview (WH-07.15). */
export type EndpointPreviewRequest = {
  /**
   * The endpoint settings to render, saved or not.
   */
  endpoint: WebhookEndpointInput;
  /**
   * A saved endpoint's own variables are used too.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  endpoint_id?: Ulid;
  /**
   * Render against this email; without an email, SMS or request ID the sample event is used.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  email_id?: Ulid;
  /**
   * Render against this SMS.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  sms_id?: Ulid;
  /**
   * Render against this captured HTTP request.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  http_request_id?: Ulid;
  /**
   * Send-time values by variable name (no `vars.`); they win for this render (WH-05.5).
   * @example {"app_token": "test-token"}
   */
  variables?: Record<string, string>;
};

export type EndpointPreviewResult = {
  rendered_against: string;
  event_type: AppEventType;
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body: string;
  problems: RenderProblem[];
};

/** Body of POST /api/v1/webhooks/endpoints/{endpointId}/send (WH-05.1, WH-05.3); neither id means the sample. */
export type ManualSendRequest = {
  /**
   * Send this email as the event.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  email_id?: Ulid;
  /**
   * Send this SMS as the event.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  sms_id?: Ulid;
  /**
   * A captured HTTP request, sent as an `http.captured` event (HC-01.7).
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  http_request_id?: Ulid;
  /**
   * A template used for this send instead of the endpoint's request.
   * @example "slack.incoming_webhook"
   */
  template_id?: string;
  /**
   * A hand-written request replacing the endpoint's, from the composer.
   */
  request?: WebhookEndpointInput;
  /**
   * Send-time values by variable name (no `vars.`), for this send only (WH-05.5).
   * @example {"app_token": "test-token"}
   */
  variables?: Record<string, string>;
  /**
   * An edited body, sent as written (WH-05.6).
   * @example "{\"text\": \"hello\"}"
   */
  body?: string;
};

/** GET /api/v1/webhooks/endpoints/{endpointId}/secret (WH-01.3). */
export type RevealedEndpointSecret = {
  secret: string;
};

/** Body of POST /api/v1/webhooks/endpoints/{endpointId}/rotate-secret. */
export type RotateSecretRequest = {
  /**
   * How many hours the old secret keeps signing next to the new one (default 24).
   * @example 24
   */
  overlap_hours: number;
};
