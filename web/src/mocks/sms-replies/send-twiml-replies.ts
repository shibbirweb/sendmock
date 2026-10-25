import type { SmsMessageDetail } from "@/lib/api/types";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";
import { simulateSmsDelivery } from "@/mocks/realtime/simulate-sms-delivery";

/** TwiML replies go through the normal delivery simulation, like any sent message (04-sms). */
export function sendRepliesFromTwiml(replies: SmsMessageDetail[]) {
  replies.forEach((reply) => {
    publishMockEvent("sms.sent", {
      id: reply.id,
      to_number: reply.to_number,
      body: reply.body,
    });
    simulateSmsDelivery(reply);
  });
}
