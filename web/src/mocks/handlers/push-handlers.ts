import { http, HttpResponse } from "msw";

import type { PushNotification } from "@/lib/api/types";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
  keepRequestedProject,
  paginateItems,
} from "@/mocks/handlers/handler-utils";

/** The list filters the binary takes: project, token, provider and status. */
function matchesPushFilters(
  pushNotification: PushNotification,
  searchParameters: URLSearchParams,
): boolean {
  return (["device_token", "provider", "status"] as const).every(
    (filterName) => {
      const filterValue = searchParameters.get(filterName);

      return (
        filterValue === null ||
        filterValue === "" ||
        pushNotification[filterName] === filterValue
      );
    },
  );
}

function listMatchingPushes(searchParameters: URLSearchParams) {
  return keepRequestedProject(
    mockDatabase.pushNotifications,
    searchParameters,
  ).filter((pushNotification) =>
    matchesPushFilters(pushNotification, searchParameters),
  );
}

export const pushHandlers = [
  http.get("*/api/v1/push", async ({ request }) => {
    const conditionResponse = await applyMockConditions();
    if (conditionResponse) {
      return conditionResponse;
    }
    const requestUrl = new URL(request.url);

    return HttpResponse.json(
      paginateItems(listMatchingPushes(requestUrl.searchParams), requestUrl),
    );
  }),

  http.delete("*/api/v1/push", async ({ request }) => {
    await applyMockConditions();
    const deletedIds = new Set(
      listMatchingPushes(new URL(request.url).searchParams).map(
        (pushNotification) => pushNotification.id,
      ),
    );
    mockDatabase.pushNotifications = mockDatabase.pushNotifications.filter(
      (pushNotification) => !deletedIds.has(pushNotification.id),
    );

    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/api/v1/push/:pushId", async ({ params }) => {
    await applyMockConditions();
    const pushNotification = mockDatabase.pushNotifications.find(
      (storedPush) => storedPush.id === params.pushId,
    );

    return pushNotification === undefined
      ? createNotFoundResponse("Push notification")
      : HttpResponse.json(pushNotification);
  }),

  http.delete("*/api/v1/push/:pushId", async ({ params }) => {
    await applyMockConditions();
    mockDatabase.pushNotifications = mockDatabase.pushNotifications.filter(
      (storedPush) => storedPush.id !== params.pushId,
    );

    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/api/v1/wait/push", async ({ request }) => {
    await applyMockConditions();
    const waitQuery = new URL(request.url).searchParams;
    const tokenFilter = waitQuery.get("device_token");
    const newestPush = keepRequestedProject(
      mockDatabase.pushNotifications,
      waitQuery,
    ).find(
      (pushNotification) =>
        tokenFilter === null || pushNotification.device_token === tokenFilter,
    );

    return newestPush === undefined
      ? createErrorResponse(
          408,
          "timeout",
          "No matching push notification arrived in time",
        )
      : HttpResponse.json(newestPush);
  }),
];
