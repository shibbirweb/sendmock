import type { SmsMessageDetail } from "@/lib/api/types";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";
import { simulateSmsDelivery } from "@/mocks/realtime/simulate-sms-delivery";
import { readSmsThreadId } from "@/mocks/fixtures/sms-thread-id";

/** TwiML replies go through the normal delivery simulation, like any sent message (04-sms). */
export function sendRepliesFromTwiml(replies: SmsMessageDetail[]) {
  replies.forEach((reply) => {
    publishMockEvent("sms.sent", {
      id: reply.id,
      to_number: reply.to_number,
      thread_id: readSmsThreadId(reply),
      body: reply.body,
    });
    simulateSmsDelivery(reply);
  });
}
