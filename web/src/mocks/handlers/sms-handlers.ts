import { http, HttpResponse } from "msw";

import type { SmsMessageDetail, SmsStatus, SmsThread } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import { buildPlaceholderSvg } from "@/mocks/fixtures/fixture-helpers";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
  includesText,
  paginateItems,
} from "@/mocks/handlers/handler-utils";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";
import { applySmsStatus } from "@/mocks/realtime/simulate-sms-delivery";

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

  http.get("*/api/v1/sms/:smsId/media/:mediaIndex", async ({ params }) => {
    await applyMockConditions();
    const smsMessage = findSms(params.smsId);
    const mediaItem = smsMessage?.media[Number(params.mediaIndex)];
    if (smsMessage === undefined || mediaItem === undefined) {
      return createNotFoundResponse("Media");
    }

    const storedBytes = mockDatabase.smsMediaContents.get(
      `${smsMessage.id}/${mediaItem.media_index}`,
    );
    if (storedBytes !== undefined) {
      return new HttpResponse(storedBytes.slice().buffer, {
        headers: { "Content-Type": mediaItem.content_type },
      });
    }

    // Demo media and URL media have no stored bytes: show a labelled placeholder.
    return new HttpResponse(
      buildPlaceholderSvg(
        mediaItem.filename ?? mediaItem.source_url ?? "media",
      ),
      { headers: { "Content-Type": "image/svg+xml" } },
    );
  }),

  http.post("*/api/v1/sms/:smsId/status", async ({ params, request }) => {
    await applyMockConditions();
    const smsMessage = findSms(params.smsId);
    if (!smsMessage) {
      return createNotFoundResponse("SMS");
    }

    const { status, error_code: errorCode } = (await request.json()) as {
      status: SmsStatus;
      error_code?: string | null;
    };
    applySmsStatus(smsMessage, status, errorCode ?? null);

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

  http.delete("*/api/v1/sms/:smsId", async ({ params }) => {
    await applyMockConditions();
    mockDatabase.smsMessages = mockDatabase.smsMessages.filter(
      (smsMessage) => smsMessage.id !== params.smsId,
    );

    return new HttpResponse(null, { status: 204 });
  }),
];
