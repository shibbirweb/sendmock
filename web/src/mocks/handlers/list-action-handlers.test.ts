import { getResponse, HttpHandler } from "msw";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import type {
  AppEvent,
  AppStats,
  CapturedHttpRequest,
  PushNotification,
  SmsThread,
} from "@/lib/api/types";
import { mockDatabase, replaceMockDatabase } from "@/mocks/db/mock-database";
import { mockHandlers } from "@/mocks/handlers";
import { subscribeToMockEvents } from "@/mocks/realtime/mock-event-bus";

const httpHandlers = mockHandlers.filter(
  (mockHandler): mockHandler is HttpHandler =>
    mockHandler instanceof HttpHandler,
);

async function callApi(
  method: string,
  path: string,
  requestBody?: unknown,
): Promise<Response> {
  const response = await getResponse(
    httpHandlers,
    new Request(`http://localhost/api/v1${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
    }),
  );
  if (response === undefined) {
    throw new Error(`No mock handler for ${method} ${path}`);
  }

  return response;
}

async function readJson<ResponseBody>(
  method: string,
  path: string,
): Promise<ResponseBody> {
  return (await (await callApi(method, path)).json()) as ResponseBody;
}

async function readFirstThread(): Promise<SmsThread> {
  const smsThreads = await readJson<SmsThread[]>("GET", "/sms/threads");
  const firstThread = smsThreads[0];
  if (firstThread === undefined) {
    throw new Error("the demo data has no conversation");
  }

  return firstThread;
}

let publishedEvents: AppEvent[] = [];
let stopListening = () => {};

beforeEach(() => {
  replaceMockDatabase("standard");
  publishedEvents = [];
  stopListening = subscribeToMockEvents((appEvent) => {
    publishedEvents.push(appEvent);
  });
});

afterEach(() => {
  stopListening();
});

describe("list actions in the mock API", () => {
  test("UI-14.3 marking a conversation unread flags its newest message, and read clears it", async () => {
    const smsThread = await readFirstThread();

    const unreadResponse = await callApi(
      "PATCH",
      `/sms/threads/${smsThread.thread_id}`,
      { is_read: false },
    );
    const unreadThread = (await readFirstThread()).unread_count;
    await callApi("PATCH", `/sms/threads/${smsThread.thread_id}`, {
      is_read: true,
    });
    const readThread = (await readFirstThread()).unread_count;

    expect(unreadResponse.status).toBe(204);
    expect(unreadThread).toBeGreaterThanOrEqual(1);
    expect(readThread).toBe(0);
  });

  test("UI-14.3 pushes and captured requests are marked read or unread and counted in the stats", async () => {
    const pushNotification = mockDatabase.pushNotifications[0];
    const capturedRequest = mockDatabase.capturedHttpRequests[0];
    if (pushNotification === undefined || capturedRequest === undefined) {
      throw new Error("the demo data has no push or captured request");
    }
    const statsBefore = await readJson<AppStats>("GET", "/stats");

    const updatedPush = (await (
      await callApi("PATCH", `/push/${pushNotification.id}`, {
        is_read: !pushNotification.is_read,
      })
    ).json()) as PushNotification;
    const updatedRequest = (await (
      await callApi("PATCH", `/http/requests/${capturedRequest.id}`, {
        is_read: !capturedRequest.is_read,
      })
    ).json()) as CapturedHttpRequest;
    const statsAfter = await readJson<AppStats>("GET", "/stats");

    expect(updatedPush.is_read).toBe(!pushNotification.is_read);
    expect(updatedRequest.is_read).toBe(!capturedRequest.is_read);
    expect(statsAfter.unread_push_count).not.toBe(
      statsBefore.unread_push_count,
    );
    expect(statsAfter.unread_http_request_count).not.toBe(
      statsBefore.unread_http_request_count,
    );
  });

  test("UI-14.4 delete all with a project picked deletes only that project's SMS", async () => {
    const shopMessage = mockDatabase.smsMessages[0];
    if (shopMessage === undefined) {
      throw new Error("the demo data has no SMS");
    }
    shopMessage.project = "shop";
    const otherMessageCount = mockDatabase.smsMessages.length - 1;

    const deleteResponse = await callApi("DELETE", "/sms?project=shop");

    expect(deleteResponse.status).toBe(204);
    expect(mockDatabase.smsMessages).toHaveLength(otherMessageCount);
    expect(
      mockDatabase.smsMessages.some(
        (smsMessage) => smsMessage.project === "shop",
      ),
    ).toBe(false);
  });

  test("UI-14.5 deliveries in flight cannot be deleted, and delete all keeps them", async () => {
    const [inFlightDelivery, finishedDelivery] = mockDatabase.webhookDeliveries;
    if (inFlightDelivery === undefined || finishedDelivery === undefined) {
      throw new Error("the demo data has too few deliveries");
    }
    inFlightDelivery.status = "pending";
    finishedDelivery.status = "succeeded";

    const deleteOneResponse = await callApi(
      "DELETE",
      `/webhooks/deliveries/${inFlightDelivery.id}`,
    );
    await callApi("DELETE", "/webhooks/deliveries");

    expect(deleteOneResponse.status).toBe(409);
    expect(mockDatabase.webhookDeliveries.map(({ id }) => id)).toContain(
      inFlightDelivery.id,
    );
    expect(mockDatabase.webhookDeliveries.map(({ id }) => id)).not.toContain(
      finishedDelivery.id,
    );
  });

  test("UI-14.6 delete all traffic empties every traffic list and keeps the configuration", async () => {
    const endpointCount = mockDatabase.webhookEndpoints.length;
    const binCount = mockDatabase.httpBins.length;
    const serviceCount = mockDatabase.verifyServices.length;

    const deleteResponse = await callApi("DELETE", "/traffic");

    expect(deleteResponse.status).toBe(204);
    expect(mockDatabase.emails).toEqual([]);
    expect(mockDatabase.smsMessages).toEqual([]);
    expect(mockDatabase.verifications).toEqual([]);
    expect(mockDatabase.pushNotifications).toEqual([]);
    expect(mockDatabase.capturedHttpRequests).toEqual([]);
    expect(mockDatabase.payments).toEqual([]);
    expect(mockDatabase.smtpSessions).toEqual([]);
    expect(mockDatabase.apiRequestLog).toEqual([]);
    expect(mockDatabase.webhookEndpoints).toHaveLength(endpointCount);
    expect(mockDatabase.httpBins).toHaveLength(binCount);
    expect(mockDatabase.verifyServices).toHaveLength(serviceCount);
  });

  test("UI-14.7 a delete all publishes one traffic.cleared with the kinds, project and count", async () => {
    const pushCount = mockDatabase.pushNotifications.length;

    await callApi("DELETE", "/push");

    const clearedEvents = publishedEvents.filter(
      (appEvent) => appEvent.type === "traffic.cleared",
    );
    expect(clearedEvents).toHaveLength(1);
    expect(clearedEvents[0]?.data).toEqual({
      kinds: ["push"],
      project: null,
      deleted_count: pushCount,
    });
  });

  test("UI-14.2 deleting a conversation removes its messages", async () => {
    const smsThread = await readFirstThread();

    await callApi("DELETE", `/sms/threads/${smsThread.thread_id}`);
    const remainingThreads = await readJson<SmsThread[]>("GET", "/sms/threads");

    expect(
      remainingThreads.map((remainingThread) => remainingThread.thread_id),
    ).not.toContain(smsThread.thread_id);
  });
});
