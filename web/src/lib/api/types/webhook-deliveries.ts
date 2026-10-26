import type { IsoTimestamp, PageRequest, Ulid } from "@/lib/api/types/common";
import type { AppEventType } from "@/lib/api/types/events";
import type { HttpMethod } from "@/lib/api/types/webhook-endpoints";

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
  /**
   * Renders the request again with today's template and variables; false resends the stored request as it was.
   * @example false
   */
  rerender: boolean;
  /**
   * An edited body and headers; left out to resend the stored request.
   * @example "{\"type\": \"email.received\"}"
   */
  body?: string;
  /**
   * Edited headers, by name; left out to resend the stored ones.
   * @example {"X-Replay": "1"}
   */
  headers?: Record<string, string>;
};

/** Body of POST /api/v1/webhooks/saved. */
export type SavedDeliveryInput = {
  /**
   * A name for the saved delivery.
   * @example "Failed order webhook"
   */
  name: string;
  /**
   * The delivery to save.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  delivery_id: Ulid;
};

/** Body of POST /api/v1/webhooks/saved/{savedId}/send (WH-10.2). */
export type SavedDeliverySendRequest = {
  /**
   * The endpoint to send it to.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  endpoint_id: Ulid;
  /**
   * Renders again with the endpoint's template and variables; false sends the saved request as it was.
   * @example false
   */
  rerender: boolean;
};

/** Body of PATCH /api/v1/webhooks/saved/{savedId}. */
export type SavedDeliveryRename = {
  /**
   * The new name.
   * @example "Order webhook, missing SKU"
   */
  name: string;
};

/** Body of POST /api/v1/webhooks/saved/{savedId}/template (WH-10.2). */
export type SaveAsTemplateRequest = {
  /**
   * The name of the new custom template.
   * @example "Order webhook"
   */
  name: string;
};

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
