import type { EmailDeliveryStatus, EmailDetail } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

/** Sets a delivery outcome, adds it to the timeline and fires its event. */
export function applyEmailOutcome(
  email: EmailDetail,
  deliveryStatus: EmailDeliveryStatus,
  timelineDetail: string,
) {
  email.delivery_status = deliveryStatus;
  mockDatabase.emailTimelines.get(email.id)?.push({
    kind: deliveryStatus,
    at: new Date().toISOString(),
    detail: timelineDetail,
  });
  publishMockEvent(`email.${deliveryStatus}`, { id: email.id });
}
