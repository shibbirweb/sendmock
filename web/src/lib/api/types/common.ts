/**
 * Shared shapes of the SendMock REST API (docs/plan/06-api.md). Field names mirror
 * the JSON wire format (snake_case); the schemas in docs/api/openapi.yaml are
 * generated from these types (`bun run openapi`).
 */

/** Sortable unique ID (ULID), e.g. "01JB6Z3K8Q2W5X7Y9A1B3C5D7E". */
export type Ulid = string;

/** RFC 3339 UTC timestamp, e.g. "2026-10-24T16:00:00Z". */
export type IsoTimestamp = string;

export type EmailAddress = {
  name: string;
  address: string;
};

export type PageOf<ItemType> = {
  items: ItemType[];
  next_cursor: string | null;
  total_count: number;
};

export type PageRequest = {
  cursor?: string;
  limit?: number;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    field?: string;
  };
};

/** Who created a configuration item; agents get a badge in the UI. */
export type CreatedBy = "ui" | "api" | "cli" | "mcp" | "seed";

export type ExtractedData = {
  otp: string[];
  links: string[];
};

export type OpenSource = "ui" | "manual" | "api";

/** The webhook choice every action that simulates traffic takes (WH-13.5). */
export type WebhookChoice = {
  /**
   * Send this action's webhooks to exactly these endpoints (IDs from `GET /api/v1/webhooks/endpoints`) instead of the ones the rules pick; an empty list sends none. Leave it out to let the rules decide.
   * @example ["01JB7T9Q2RENDPOINT00000000"]
   */
  webhook_endpoint_ids?: Ulid[];
  /**
   * Payloads edited for this action, by endpoint: each body is sent as written instead of the rendered one and signed over those bytes. Leave it out to send the rendered payloads.
   */
  webhook_requests?: WebhookRequestEdit[];
};

/** A request edited before an action sends it (WH-14.4). */
export type WebhookRequestEdit = {
  /**
   * The endpoint the edited request goes to; when `webhook_endpoint_ids` is given, it must be one of them.
   * @example "01JB7T9Q2RENDPOINT00000000"
   */
  endpoint_id: Ulid;
  /**
   * The event the edit is for, as `POST /api/v1/webhooks/rules/match` named it; left out, every event this action sends to the endpoint.
   * @example "email.bounced"
   */
  event_type?: string;
  /**
   * The body, sent exactly as written and signed over these bytes with the endpoint's secret.
   * @example "{\"type\":\"email.bounced\",\"data\":{\"reason\":\"edited\"}}"
   */
  body: string;
  /**
   * Headers to set or change, by name; the others are sent as rendered. Signature headers are made by the sender.
   * @example {"x-tenant":"acme"}
   */
  headers?: Record<string, string>;
};

/** Body of `POST /emails/{emailId}/open` and `POST /sms/{smsId}/open`. */
export type OpenEventRequest = WebhookChoice & {
  /**
   * Who opened it: `ui` (the SendMock UI), `manual` (a person marking it) or `api` (a script). Defaults to `api`.
   * @example "api"
   */
  source?: OpenSource;
  /**
   * The browser or client that opened it, kept in the open history. The UI sends its own.
   * @example "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)"
   */
  user_agent?: string;
};

/** Body of `POST /emails/{emailId}/clicks`. */
export type EmailClickRequest = WebhookChoice & {
  /**
   * The link that was clicked; one of the email's links (`extracted.links`).
   * @example "https://app.test/verify?token=abc123"
   */
  url: string;
  /**
   * Who clicked it: `ui` (a link in the preview), `manual` (Simulate click) or `api` (a script). Defaults to `api`.
   * @example "api"
   */
  source?: OpenSource;
  /**
   * The browser or client that clicked, kept in the click history. The UI sends its own.
   * @example "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)"
   */
  user_agent?: string;
};

/** One click on an email's link, newest first in `GET /emails/{emailId}/clicks`. */
export type EmailClickRecord = {
  clicked_at: IsoTimestamp;
  url: string;
  source: OpenSource;
  user_agent: string | null;
};

/** One open of an email or SMS, oldest first in `GET /emails/{emailId}/opens` and `GET /sms/{smsId}/opens`. */
export type OpenRecord = {
  opened_at: IsoTimestamp;
  source: OpenSource;
  user_agent: string | null;
};
