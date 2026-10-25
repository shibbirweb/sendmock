import { http, HttpResponse } from "msw";

import type { InboundSmsRequest, NativeSmsRequest } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { buildNewSmsMessage } from "@/mocks/fixtures/sms-message-builder";
import { type ParsedSmsMedia, parseSmsMedia } from "@/mocks/fixtures/sms-media";
import {
  applyMockConditions,
  createErrorResponse,
} from "@/mocks/handlers/handler-utils";
import { recordNativeApiRequest } from "@/mocks/handlers/record-api-request";
import { planSmsOutcome } from "@/mocks/realtime/outcome-plans";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";
import { simulateSmsDelivery } from "@/mocks/realtime/simulate-sms-delivery";
import { runReplyWebhook } from "@/mocks/sms-replies/run-reply-webhook";
import { sendRepliesFromTwiml } from "@/mocks/sms-replies/send-twiml-replies";

const whatsappPrefix = "whatsapp:";

function findMissingSendField(nativeSmsRequest: Partial<NativeSmsRequest>) {
  const requiredFields = ["from", "to", "body"] as const;

  return requiredFields.find(
    (fieldName) => (nativeSmsRequest[fieldName] ?? "").trim() === "",
  );
}

/** Keeps the bytes of inline media so the media endpoint can serve them. */
function storeSmsMediaBytes(smsId: string, parsedMedia: ParsedSmsMedia[]) {
  for (const [mediaIndex, { fileBytes }] of parsedMedia.entries()) {
    if (fileBytes !== null) {
      mockDatabase.smsMediaContents.set(`${smsId}/${mediaIndex}`, fileBytes);
    }
  }
}

/** The logged request keeps media names, not their base64. */
function summarizeMediaForLog(nativeSmsRequest: Partial<NativeSmsRequest>) {
  return {
    ...nativeSmsRequest,
    media: nativeSmsRequest.media?.map((inlineMedia) => ({
      ...inlineMedia,
      content: `<${(inlineMedia.content ?? "").length} base64 characters>`,
    })),
  };
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
      const errorMessage = `The ${missingField} field is required`;
      recordNativeApiRequest({
        path: "/api/v1/sms",
        requestBody: nativeSmsRequest,
        responseStatus: 400,
        responseBody: {
          error: { code: "validation_failed", message: errorMessage },
        },
      });

      return createErrorResponse(400, "validation_failed", errorMessage);
    }

    const mediaResult = parseSmsMedia(nativeSmsRequest);
    if (!mediaResult.isValid) {
      recordNativeApiRequest({
        path: "/api/v1/sms",
        requestBody: summarizeMediaForLog(nativeSmsRequest),
        responseStatus: 400,
        responseBody: {
          error: {
            code: "validation_failed",
            message: mediaResult.errorMessage,
          },
        },
      });

      return createErrorResponse(
        400,
        "validation_failed",
        mediaResult.errorMessage,
      );
    }

    const toNumber = nativeSmsRequest.to ?? "";
    const outcomePlan = planSmsOutcome(toNumber, nativeSmsRequest.from ?? "");
    if (outcomePlan?.outcome === "reject") {
      const rejectMessage = `Rejected with error ${outcomePlan.errorCode ?? "unknown"} (${outcomePlan.sourceLabel})`;
      recordNativeApiRequest({
        path: "/api/v1/sms",
        requestBody: summarizeMediaForLog(nativeSmsRequest),
        responseStatus: 400,
        responseBody: {
          error: { code: "sms_rejected", message: rejectMessage },
        },
      });

      return createErrorResponse(400, "sms_rejected", rejectMessage);
    }

    const outboundMessage = buildNewSmsMessage({
      direction: "outbound",
      channel: toNumber.startsWith(whatsappPrefix) ? "whatsapp" : "sms",
      api: "native",
      fromNumber: nativeSmsRequest.from ?? "",
      toNumber,
      body: nativeSmsRequest.body ?? "",
      statusCallbackUrl: nativeSmsRequest.status_callback ?? null,
      parsedMedia: mediaResult.media,
    });
    storeSmsMediaBytes(outboundMessage.id, mediaResult.media);

    outboundMessage.api_request_id = recordNativeApiRequest({
      path: "/api/v1/sms",
      requestBody: summarizeMediaForLog(nativeSmsRequest),
      responseStatus: 201,
      responseBody: { id: outboundMessage.id, status: outboundMessage.status },
      linkedMessage: {
        kind: "sms",
        id: outboundMessage.id,
        sms_thread_id: `${outboundMessage.from_number}|${outboundMessage.to_number}`,
      },
    });
    mockDatabase.smsMessages.unshift(outboundMessage);
    publishMockEvent("sms.sent", {
      id: outboundMessage.id,
      to_number: outboundMessage.to_number,
      thread_id: `${outboundMessage.from_number}|${outboundMessage.to_number}`,
      body: outboundMessage.body,
    });
    simulateSmsDelivery(outboundMessage, outcomePlan);

    return HttpResponse.json(outboundMessage, { status: 201 });
  }),

  http.post("*/api/v1/sms/inbound", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const inboundSmsRequest = (await request.json()) as InboundSmsRequest;
    const inboundMediaResult = parseSmsMedia(inboundSmsRequest);
    if (!inboundMediaResult.isValid) {
      return createErrorResponse(
        400,
        "validation_failed",
        inboundMediaResult.errorMessage,
      );
    }

    const inboundMessage = buildNewSmsMessage({
      direction: "inbound",
      channel: inboundSmsRequest.channel ?? "sms",
      api: "twilio",
      fromNumber: inboundSmsRequest.from,
      toNumber: inboundSmsRequest.to,
      body: inboundSmsRequest.body,
      parsedMedia: inboundMediaResult.media,
    });
    storeSmsMediaBytes(inboundMessage.id, inboundMediaResult.media);

    mockDatabase.smsMessages.unshift(inboundMessage);
    publishMockEvent("sms.inbound", {
      id: inboundMessage.id,
      from_number: inboundMessage.from_number,
      body: inboundMessage.body,
      thread_id: `${inboundMessage.to_number}|${inboundMessage.from_number}`,
    });
    sendRepliesFromTwiml(runReplyWebhook(mockDatabase, inboundMessage));

    return HttpResponse.json(inboundMessage, { status: 201 });
  }),
];
