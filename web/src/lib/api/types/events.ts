import type { IsoTimestamp } from "@/lib/api/types/common";

/** Every event mss publishes; the same names are used by webhook rules. */
export const appEventTypes = [
  "email.received",
  "email.opened",
  "email.delivered",
  "email.deferred",
  "email.bounced",
  "email.complained",
  "email.unsubscribed",
  "email.released",
  "email.deleted",
  "sms.sent",
  "sms.status",
  "sms.opened",
  "sms.inbound",
  "verify.started",
  "verify.checked",
  "verify.expired",
  "http.captured",
  "webhook.delivered",
  "webhook.failed",
  "test.ping",
] as const;

export type AppEventType = (typeof appEventTypes)[number];

/** Envelope pushed over the realtime WebSocket and sent in native webhooks. */
export type AppEvent = {
  id: string;
  type: AppEventType;
  created_at: IsoTimestamp;
  /** Trimmed to list-view fields of the subject (email, SMS, delivery, ...). */
  data: Record<string, unknown>;
};
