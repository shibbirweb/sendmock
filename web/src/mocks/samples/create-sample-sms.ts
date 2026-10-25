import { mockDatabase } from "@/mocks/db/mock-database";
import { buildNewSmsMessage } from "@/mocks/fixtures/sms-message-builder";
import { recordNativeApiRequest } from "@/mocks/handlers/record-api-request";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";
import { simulateSmsDelivery } from "@/mocks/realtime/simulate-sms-delivery";

/**
 * Sends an outbound SMS through the native API path, so it also shows in
 * Logs > API requests, and moves it towards delivered (UI-04.2).
 */
export function sendOutboundSmsSample({
  fromNumber,
  toNumber,
  body,
}: {
  fromNumber: string;
  toNumber: string;
  body: string;
}) {
  const outboundMessage = buildNewSmsMessage({
    direction: "outbound",
    channel: "sms",
    api: "native",
    fromNumber,
    toNumber,
    body,
  });
  outboundMessage.api_request_id = recordNativeApiRequest({
    path: "/api/v1/sms",
    requestBody: { from: fromNumber, to: toNumber, body },
    responseStatus: 201,
    responseBody: { id: outboundMessage.id, status: outboundMessage.status },
    linkedMessage: {
      kind: "sms",
      id: outboundMessage.id,
      sms_thread_id: `${fromNumber}|${toNumber}`,
    },
  });
  mockDatabase.smsMessages.unshift(outboundMessage);
  publishMockEvent("sms.sent", {
    id: outboundMessage.id,
    to_number: outboundMessage.to_number,
    thread_id: `${outboundMessage.from_number}|${outboundMessage.to_number}`,
    body: outboundMessage.body,
  });
  simulateSmsDelivery(outboundMessage);

  return outboundMessage;
}

export function createSampleSms(): string {
  return sendOutboundSmsSample({
    fromNumber: "+15550001111",
    toNumber: "+14155550100",
    body: "Your Acme verification code is 615204. It expires in 10 minutes.",
  }).id;
}
