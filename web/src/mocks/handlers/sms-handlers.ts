import { http, HttpResponse } from "msw";

import type {
  ForcedVerificationState,
  InboundSmsRequest,
  SmsMessageDetail,
  SmsStatus,
  SmsThread,
  VerificationStatus,
} from "@/lib/api/types";
import { calculateSmsSegments } from "@/lib/sms/calculate-sms-segments";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  createMockUlid,
  createProviderId,
  extractFixtureData,
} from "@/mocks/fixtures/fixture-helpers";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
  includesText,
  paginateItems,
} from "@/mocks/handlers/handler-utils";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

function findSms(smsId: unknown): SmsMessageDetail | undefined {
  return mockDatabase.smsMessages.find((smsMessage) => smsMessage.id === smsId);
}

function readThreadParticipants(smsMessage: SmsMessageDetail) {
  const isOutbound = smsMessage.direction === "outbound";

  return {
    appNumber: isOutbound ? smsMessage.from_number : smsMessage.to_number,
    contactNumber: isOutbound ? smsMessage.to_number : smsMessage.from_number,
  };
}

function buildSmsThreads(): SmsThread[] {
  const threadsById = new Map<string, SmsThread>();

  for (const smsMessage of mockDatabase.smsMessages) {
    const { appNumber, contactNumber } = readThreadParticipants(smsMessage);
    const threadId = `${appNumber}|${contactNumber}`;
    const existingThread = threadsById.get(threadId);

    if (existingThread) {
      existingThread.message_count += 1;
      continue;
    }

    threadsById.set(threadId, {
      thread_id: threadId,
      app_number: appNumber,
      contact_number: contactNumber,
      channel: smsMessage.channel,
      last_message: smsMessage,
      message_count: 1,
      unread_count: smsMessage.direction === "inbound" ? 1 : 0,
    });
  }

  return [...threadsById.values()];
}

const forcedStateToStatus: Record<ForcedVerificationState, VerificationStatus> =
  {
    approved: "approved",
    canceled: "canceled",
    expired: "expired",
    max_attempts: "max_attempts_reached",
  };

export const smsHandlers = [
  http.get("*/api/v1/sms", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }

    const requestUrl = new URL(request.url);
    const searchQuery = requestUrl.searchParams.get("query") ?? "";
    const threadFilter = requestUrl.searchParams.get("thread_id");
    const matchingMessages = mockDatabase.smsMessages.filter((smsMessage) => {
      const { appNumber, contactNumber } = readThreadParticipants(smsMessage);
      if (threadFilter && `${appNumber}|${contactNumber}` !== threadFilter) {
        return false;
      }

      return includesText(smsMessage.body, searchQuery);
    });

    return HttpResponse.json(paginateItems(matchingMessages, requestUrl));
  }),

  http.get("*/api/v1/sms/threads", async () => {
    const conditionResponse = await applyMockConditions();

    return conditionResponse ?? HttpResponse.json(buildSmsThreads());
  }),

  http.get("*/api/v1/sms/:smsId", async ({ params }) => {
    await applyMockConditions();
    const smsMessage = findSms(params.smsId);

    return smsMessage
      ? HttpResponse.json(smsMessage)
      : createNotFoundResponse("SMS");
  }),

  http.post("*/api/v1/sms/:smsId/status", async ({ params, request }) => {
    await applyMockConditions();
    const smsMessage = findSms(params.smsId);
    if (!smsMessage) {
      return createNotFoundResponse("SMS");
    }

    const { status } = (await request.json()) as { status: SmsStatus };
    smsMessage.status = status;
    smsMessage.status_history.push({
      status,
      at: new Date().toISOString(),
      error_code: null,
    });
    publishMockEvent("sms.status", { id: smsMessage.id, status });

    return HttpResponse.json(smsMessage);
  }),

  http.post("*/api/v1/sms/:smsId/open", async ({ params }) => {
    await applyMockConditions();
    const smsMessage = findSms(params.smsId);
    if (!smsMessage) {
      return createNotFoundResponse("SMS");
    }
    if (smsMessage.direction === "inbound") {
      return createErrorResponse(
        409,
        "conflict",
        "Inbound SMS cannot be opened",
      );
    }

    smsMessage.open_count += 1;
    smsMessage.opened_at = smsMessage.opened_at ?? new Date().toISOString();
    publishMockEvent("sms.opened", { id: smsMessage.id });

    return new HttpResponse(null, { status: 204 });
  }),

  http.post("*/api/v1/sms/inbound", async ({ request }) => {
    await applyMockConditions();
    const inboundSmsRequest = (await request.json()) as InboundSmsRequest;
    const segmentInfo = calculateSmsSegments(inboundSmsRequest.body);
    const createdAt = new Date().toISOString();
    const inboundMessage: SmsMessageDetail = {
      id: createMockUlid(),
      provider_id: createProviderId("SM"),
      direction: "inbound",
      channel: inboundSmsRequest.channel ?? "sms",
      api: "twilio",
      from_number: inboundSmsRequest.from,
      to_number: inboundSmsRequest.to,
      body: inboundSmsRequest.body,
      encoding: segmentInfo.encoding,
      segments: segmentInfo.segmentCount,
      media_urls: [],
      status: "received",
      error_code: null,
      status_callback_url: null,
      messaging_service_sid: null,
      account: null,
      extracted: extractFixtureData(inboundSmsRequest.body),
      opened_at: null,
      open_count: 0,
      created_at: createdAt,
      updated_at: createdAt,
      status_history: [{ status: "received", at: createdAt, error_code: null }],
      request_body: null,
      api_request_id: null,
    };

    mockDatabase.smsMessages.unshift(inboundMessage);
    publishMockEvent("sms.inbound", { id: inboundMessage.id });

    return HttpResponse.json(inboundMessage, { status: 201 });
  }),

  http.delete("*/api/v1/sms/:smsId", async ({ params }) => {
    await applyMockConditions();
    mockDatabase.smsMessages = mockDatabase.smsMessages.filter(
      (smsMessage) => smsMessage.id !== params.smsId,
    );

    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/api/v1/verify", async ({ request }) => {
    const conditionResponse = await applyMockConditions();

    return (
      conditionResponse ??
      HttpResponse.json(
        paginateItems(mockDatabase.verifications, new URL(request.url)),
      )
    );
  }),

  http.get("*/api/v1/verify/services", async () => {
    await applyMockConditions();

    return HttpResponse.json(mockDatabase.verifyServices);
  }),

  http.post(
    "*/api/v1/verify/:verificationSid/force",
    async ({ params, request }) => {
      await applyMockConditions();
      const verification = mockDatabase.verifications.find(
        (existingVerification) =>
          existingVerification.sid === params.verificationSid,
      );
      if (!verification) {
        return createNotFoundResponse("Verification");
      }

      const { state } = (await request.json()) as {
        state: ForcedVerificationState;
      };
      verification.status = forcedStateToStatus[state];
      publishMockEvent("verify.checked", {
        sid: verification.sid,
        status: verification.status,
      });

      return HttpResponse.json(verification);
    },
  ),

  http.get("*/api/v1/numbers", async () => {
    await applyMockConditions();

    return HttpResponse.json(mockDatabase.virtualNumbers);
  }),

  http.get("*/api/v1/messaging-services", async () => {
    await applyMockConditions();

    return HttpResponse.json(mockDatabase.messagingServices);
  }),
];
