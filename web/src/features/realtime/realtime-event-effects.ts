import type { QueryKey } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";
import type {
  AppNotification,
  NotificationLink,
} from "@/features/notifications/notification-store";
import type { AppEvent, AppEventType } from "@/lib/api/types";

/** Which cached queries an event makes stale, by the event's area prefix. */
const queryKeysByEventArea: Record<string, QueryKey[]> = {
  email: [queryKeys.emails.all, queryKeys.system.stats],
  sms: [queryKeys.sms.all, queryKeys.system.stats],
  verify: [queryKeys.verify.all, queryKeys.sms.all, queryKeys.system.stats],
  http: [queryKeys.httpCatcher.all, queryKeys.system.stats],
  webhook: [queryKeys.webhooks.all, queryKeys.system.stats],
  payment: [queryKeys.payments.all, queryKeys.system.stats],
  checkout: [queryKeys.payments.all, queryKeys.system.stats],
};

export function listQueryKeysToRefresh(eventType: AppEventType): QueryKey[] {
  const eventArea = eventType.split(".")[0] ?? "";

  return queryKeysByEventArea[eventArea] ?? [];
}

export type EventNotification = Omit<
  AppNotification,
  "id" | "createdAt" | "isRead"
>;

function readText(eventData: Record<string, unknown>, fieldName: string) {
  const fieldValue = eventData[fieldName];

  return typeof fieldValue === "string" ? fieldValue : "";
}

function linkToEmail(
  eventData: Record<string, unknown>,
): NotificationLink | null {
  const emailId = readText(eventData, "id");

  return emailId === "" ? null : { kind: "email", emailId };
}

function linkToThread(
  eventData: Record<string, unknown>,
): NotificationLink | null {
  const threadId = readText(eventData, "thread_id");

  return threadId === "" ? null : { kind: "sms", threadId };
}

type EventDescriber = (eventData: Record<string, unknown>) => EventNotification;

/** One description per event worth a notification (UI-08); others stay quiet. */
const notificationDescribers: Partial<Record<AppEventType, EventDescriber>> = {
  "email.received": (eventData) => ({
    area: "email",
    title: "New email",
    description: readText(eventData, "subject"),
    link: linkToEmail(eventData),
  }),
  "email.inbound": (eventData) => ({
    area: "email",
    title: "Incoming email",
    description: readText(eventData, "subject"),
    link: linkToEmail(eventData),
  }),
  "sms.sent": (eventData) => ({
    area: "sms",
    title: `New SMS to ${readText(eventData, "to_number")}`,
    description: readText(eventData, "body"),
    link: linkToThread(eventData),
  }),
  "sms.inbound": (eventData) => ({
    area: "sms",
    title: `Inbound SMS from ${readText(eventData, "from_number") || "a contact"}`,
    description: readText(eventData, "body"),
    link: linkToThread(eventData),
  }),
  "webhook.failed": (eventData) => {
    const deliveryId = readText(eventData, "id");
    return {
      area: "webhook",
      title: "Webhook delivery failed",
      description: [
        readText(eventData, "endpoint_name"),
        readText(eventData, "event_type"),
      ]
        .filter((descriptionPart) => descriptionPart !== "")
        .join(", "),
      link: deliveryId === "" ? null : { kind: "delivery", deliveryId },
    };
  },
};

/** A notification for events worth telling the user about, else null. */
export function describeEventForNotification(
  appEvent: AppEvent,
): EventNotification | null {
  return notificationDescribers[appEvent.type]?.(appEvent.data) ?? null;
}
