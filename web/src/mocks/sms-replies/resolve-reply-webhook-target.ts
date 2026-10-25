import type { InboundWebhookMethod, SmsMessage } from "@/lib/api/types";
import type { MockDatabase } from "@/mocks/db/mock-database";

export type ReplyWebhookTarget = {
  target: "messaging_service" | "number";
  url: string;
  method: InboundWebhookMethod;
  fallbackUrl: string | null;
};

/** "whatsapp:+15550003333" and "+15550003333" are the same number. */
function toBareNumber(phoneNumber: string): string {
  return phoneNumber.replace(/^whatsapp:/, "");
}

/**
 * Where an inbound message's reply webhook goes, first match wins (04-sms):
 * the number's Messaging Service when set to "Send a webhook", else the
 * number's own URL (also when the service defers to it), else nowhere.
 */
export function resolveReplyWebhookTarget(
  mockDatabase: Pick<MockDatabase, "virtualNumbers" | "messagingServices">,
  inboundMessage: Pick<SmsMessage, "to_number">,
): ReplyWebhookTarget | null {
  const virtualNumber = mockDatabase.virtualNumbers.find(
    (candidate) =>
      toBareNumber(candidate.number) === toBareNumber(inboundMessage.to_number),
  );
  if (virtualNumber === undefined) {
    return null;
  }
  const messagingService = mockDatabase.messagingServices.find(
    (candidate) => candidate.sid === virtualNumber.messaging_service_sid,
  );
  if (messagingService?.inbound_mode === "drop") {
    return null;
  }
  if (
    messagingService?.inbound_mode === "webhook" &&
    messagingService.inbound_url !== null
  ) {
    return {
      target: "messaging_service",
      url: messagingService.inbound_url,
      method: "POST",
      fallbackUrl: messagingService.inbound_fallback_url,
    };
  }

  return virtualNumber.inbound_url === null
    ? null
    : {
        target: "number",
        url: virtualNumber.inbound_url,
        method: virtualNumber.inbound_method,
        fallbackUrl: virtualNumber.inbound_fallback_url,
      };
}
