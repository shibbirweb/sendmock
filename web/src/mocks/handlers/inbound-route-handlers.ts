import { http, HttpResponse } from "msw";

import type {
  InboundRouteInput,
  InboundRouteTestRequest,
} from "@/lib/api/types";
import { validateInboundRoute } from "@/lib/inbound-routes/validate-inbound-route";
import { mockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import {
  applyMockConditions,
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";
import {
  presentInboundRoute,
  sortRoutesByPriority,
  testRouteFilter,
} from "@/mocks/inbound-routes/inbound-route-record";

function findRouteIndex(routeId: unknown): number {
  return mockDatabase.inboundRoutes.findIndex(
    (routeRecord) => routeRecord.id === routeId,
  );
}

function readRouteInput(routeInput: InboundRouteInput): InboundRouteInput {
  return {
    priority: routeInput.priority,
    description: routeInput.description.trim(),
    filter: routeInput.filter,
    actions: routeInput.actions,
  };
}

/** Webhooks > Inbound routes (WH-12.7): Mailgun-style routes for incoming emails. */
export const inboundRouteHandlers = [
  http.get("*/api/v1/inbound-routes", async () => {
    await applyMockConditions();

    return HttpResponse.json(
      sortRoutesByPriority(mockDatabase.inboundRoutes).map(presentInboundRoute),
    );
  }),

  http.post("*/api/v1/inbound-routes/test", async ({ request }) => {
    await applyMockConditions();
    const testRequest = (await request.json()) as InboundRouteTestRequest;

    return HttpResponse.json(
      testRouteFilter(mockDatabase.emails, testRequest.filter),
    );
  }),

  http.post("*/api/v1/inbound-routes", async ({ request }) => {
    await applyMockConditions();
    const routeInput = readRouteInput(
      (await request.json()) as InboundRouteInput,
    );
    const firstError = Object.values(validateInboundRoute(routeInput))[0];
    if (firstError !== undefined) {
      return createErrorResponse(400, "validation_failed", firstError);
    }
    const routeRecord = {
      ...routeInput,
      id: createMockUlid(),
      created_at: new Date().toISOString(),
    };
    mockDatabase.inboundRoutes.push(routeRecord);

    return HttpResponse.json(presentInboundRoute(routeRecord), {
      status: 201,
    });
  }),

  http.patch(
    "*/api/v1/inbound-routes/:routeId",
    async ({ params, request }) => {
      await applyMockConditions();
      const routeIndex = findRouteIndex(params.routeId);
      const routeRecord = mockDatabase.inboundRoutes[routeIndex];
      if (routeRecord === undefined) {
        return createNotFoundResponse("Inbound route");
      }
      const routeInput = readRouteInput(
        (await request.json()) as InboundRouteInput,
      );
      const firstError = Object.values(validateInboundRoute(routeInput))[0];
      if (firstError !== undefined) {
        return createErrorResponse(400, "validation_failed", firstError);
      }
      const savedRecord = { ...routeRecord, ...routeInput };
      mockDatabase.inboundRoutes[routeIndex] = savedRecord;

      return HttpResponse.json(presentInboundRoute(savedRecord));
    },
  ),

  http.delete("*/api/v1/inbound-routes/:routeId", async ({ params }) => {
    await applyMockConditions();
    const routeIndex = findRouteIndex(params.routeId);
    if (routeIndex === -1) {
      return createNotFoundResponse("Inbound route");
    }
    mockDatabase.inboundRoutes.splice(routeIndex, 1);

    return new HttpResponse(null, { status: 204 });
  }),
];
