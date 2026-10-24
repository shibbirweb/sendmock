import type { QueryKey } from "@tanstack/react-query";

import { queryKeys } from "@/lib/api/query-keys";
import type { AppEvent, AppEventType } from "@/lib/api/types";

/** Which cached queries an event makes stale, by the event's area prefix. */
const queryKeysByEventArea: Record<string, QueryKey[]> = {
  email: [queryKeys.emails.all, queryKeys.system.stats],
  sms: [queryKeys.sms.all, queryKeys.system.stats],
  verify: [queryKeys.verify.all, queryKeys.sms.all, queryKeys.system.stats],
  http: [queryKeys.httpCatcher.all, queryKeys.system.stats],
  webhook: [queryKeys.webhooks.all, queryKeys.system.stats],
};

export function listQueryKeysToRefresh(eventType: AppEventType): QueryKey[] {
  const eventArea = eventType.split(".")[0] ?? "";

  return queryKeysByEventArea[eventArea] ?? [];
}

type ToastMessage = { title: string; description: string };

function readText(eventData: Record<string, unknown>, fieldName: string) {
  const fieldValue = eventData[fieldName];

  return typeof fieldValue === "string" ? fieldValue : "";
}

/** A short notification for events worth interrupting the user for. */
export function describeEventForToast(appEvent: AppEvent): ToastMessage | null {
  if (appEvent.type === "email.received") {
    return {
      title: "New email",
      description: readText(appEvent.data, "subject"),
    };
  }

  if (appEvent.type === "sms.sent") {
    return {
      title: `New SMS to ${readText(appEvent.data, "to_number")}`,
      description: readText(appEvent.data, "body"),
    };
  }

  if (appEvent.type === "sms.inbound") {
    return { title: "Inbound SMS simulated", description: "" };
  }

  return null;
}
