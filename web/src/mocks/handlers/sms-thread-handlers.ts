import { http, HttpResponse } from "msw";

import type { SmsMessageDetail, SmsThread } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  readSmsThreadId,
  readThreadParticipants,
} from "@/mocks/fixtures/sms-thread-id";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
  keepRequestedProject,
  readIsReadUpdate,
} from "@/mocks/handlers/handler-utils";
import {
  publishTrafficCleared,
  readRequestedProjectKey,
} from "@/mocks/realtime/publish-traffic-cleared";

function buildSmsThreads(searchParameters: URLSearchParams): SmsThread[] {
  const threadsById = new Map<string, SmsThread>();

  for (const smsMessage of keepRequestedProject(
    mockDatabase.smsMessages,
    searchParameters,
  )) {
    const threadId = readSmsThreadId(smsMessage);
    const unreadIncrement = smsMessage.is_read ? 0 : 1;
    const existingThread = threadsById.get(threadId);

    if (existingThread) {
      existingThread.message_count += 1;
      existingThread.unread_count += unreadIncrement;
      continue;
    }

    const { appNumber, contactNumber } = readThreadParticipants(smsMessage);
    threadsById.set(threadId, {
      thread_id: threadId,
      app_number: appNumber,
      contact_number: contactNumber,
      channel: smsMessage.channel,
      last_message: smsMessage,
      message_count: 1,
      unread_count: unreadIncrement,
    });
  }

  return [...threadsById.values()];
}

/** The conversation's messages, newest first, as the database keeps them. */
function listThreadMessages(threadId: unknown): SmsMessageDetail[] {
  return mockDatabase.smsMessages.filter(
    (smsMessage) => readSmsThreadId(smsMessage) === threadId,
  );
}

export const smsThreadHandlers = [
  http.get("*/api/v1/sms/threads", async ({ request }) => {
    const conditionResponse = await applyMockConditions();

    return (
      conditionResponse ??
      HttpResponse.json(buildSmsThreads(new URL(request.url).searchParams))
    );
  }),

  http.patch("*/api/v1/sms/threads/:threadId", async ({ params, request }) => {
    await applyMockConditions();
    const isRead = readIsReadUpdate(await request.json());
    if (isRead === null) {
      return createErrorResponse(400, "invalid_body", "is_read is required");
    }
    const threadMessages = listThreadMessages(params.threadId);
    const newestMessage = threadMessages[0];
    if (newestMessage === undefined) {
      return createNotFoundResponse("Conversation");
    }

    if (isRead) {
      threadMessages.forEach((smsMessage) => {
        smsMessage.is_read = true;
      });
    } else {
      newestMessage.is_read = false;
    }

    return new HttpResponse(null, { status: 204 });
  }),

  http.delete("*/api/v1/sms/threads/:threadId", async ({ params }) => {
    await applyMockConditions();
    mockDatabase.smsMessages = mockDatabase.smsMessages.filter(
      (smsMessage) => readSmsThreadId(smsMessage) !== params.threadId,
    );

    return new HttpResponse(null, { status: 204 });
  }),

  http.delete("*/api/v1/sms", async ({ request }) => {
    await applyMockConditions();
    const searchParameters = new URL(request.url).searchParams;
    const deletedIds = new Set(
      keepRequestedProject(mockDatabase.smsMessages, searchParameters).map(
        (smsMessage) => smsMessage.id,
      ),
    );
    mockDatabase.smsMessages = mockDatabase.smsMessages.filter(
      (smsMessage) => !deletedIds.has(smsMessage.id),
    );
    publishTrafficCleared(
      ["sms"],
      readRequestedProjectKey(searchParameters),
      deletedIds.size,
    );

    return new HttpResponse(null, { status: 204 });
  }),
];
