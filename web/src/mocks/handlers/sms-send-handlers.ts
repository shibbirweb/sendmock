import { http, HttpResponse } from "msw";

import type { InboundSmsRequest, NativeSmsRequest } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { buildNewSmsMessage } from "@/mocks/fixtures/sms-message-builder";
import {
  applyMockConditions,
  createErrorResponse,
} from "@/mocks/handlers/handler-utils";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";
import { simulateSmsDelivery } from "@/mocks/realtime/simulate-sms-delivery";

const whatsappPrefix = "whatsapp:";

function findMissingSendField(nativeSmsRequest: Partial<NativeSmsRequest>) {
  const requiredFields = ["from", "to", "body"] as const;

  return requiredFields.find(
    (fieldName) => (nativeSmsRequest[fieldName] ?? "").trim() === "",
  );
}

/** Sending (native API) and simulating inbound messages. */
export const smsSendHandlers = [
  http.post("*/api/v1/sms", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const nativeSmsRequest =
      (await request.json()) as Partial<NativeSmsRequest>;
    const missingField = findMissingSendField(nativeSmsRequest);
    if (missingField !== undefined) {
      return createErrorResponse(
        400,
        "validation_failed",
        `The ${missingField} field is required`,
      );
    }

    const toNumber = nativeSmsRequest.to ?? "";
    const outboundMessage = buildNewSmsMessage({
      direction: "outbound",
      channel: toNumber.startsWith(whatsappPrefix) ? "whatsapp" : "sms",
      api: "native",
      fromNumber: nativeSmsRequest.from ?? "",
      toNumber,
      body: nativeSmsRequest.body ?? "",
      statusCallbackUrl: nativeSmsRequest.status_callback ?? null,
    });

    mockDatabase.smsMessages.unshift(outboundMessage);
    publishMockEvent("sms.sent", {
      id: outboundMessage.id,
      to_number: outboundMessage.to_number,
      body: outboundMessage.body,
    });
    simulateSmsDelivery(outboundMessage);

    return HttpResponse.json(outboundMessage, { status: 201 });
  }),

  http.post("*/api/v1/sms/inbound", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const inboundSmsRequest = (await request.json()) as InboundSmsRequest;
    const inboundMessage = buildNewSmsMessage({
      direction: "inbound",
      channel: inboundSmsRequest.channel ?? "sms",
      api: "twilio",
      fromNumber: inboundSmsRequest.from,
      toNumber: inboundSmsRequest.to,
      body: inboundSmsRequest.body,
    });

    mockDatabase.smsMessages.unshift(inboundMessage);
    publishMockEvent("sms.inbound", { id: inboundMessage.id });

    return HttpResponse.json(inboundMessage, { status: 201 });
  }),
];
