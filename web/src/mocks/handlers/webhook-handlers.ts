import { http, HttpResponse } from "msw";

import { mockDatabase } from "@/mocks/db/mock-database";
import { createMockUlid } from "@/mocks/fixtures/fixture-helpers";
import {
  applyMockConditions,
  createNotFoundResponse,
  paginateItems,
} from "@/mocks/handlers/handler-utils";
import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

/** Read-only list endpoints that return a whole collection. */
const collectionRoutes = {
  "*/api/v1/webhooks/endpoints": () => mockDatabase.webhookEndpoints,
  "*/api/v1/webhooks/rules": () => mockDatabase.webhookRules,
  "*/api/v1/webhooks/templates": () => mockDatabase.webhookTemplates,
  "*/api/v1/webhooks/variables": () => mockDatabase.webhookVariables,
  "*/api/v1/webhooks/saved": () => mockDatabase.savedDeliveries,
};

const collectionHandlers = Object.entries(collectionRoutes).map(
  ([routePath, readCollection]) =>
    http.get(routePath, async () => {
      const conditionResponse = await applyMockConditions();

      return conditionResponse ?? HttpResponse.json(readCollection());
    }),
);

export const webhookHandlers = [
  ...collectionHandlers,

  http.get("*/api/v1/webhooks/deliveries", async ({ request }) => {
    const conditionResponse = await applyMockConditions();

    return (
      conditionResponse ??
      HttpResponse.json(
        paginateItems(mockDatabase.webhookDeliveries, new URL(request.url)),
      )
    );
  }),

  http.post(
    "*/api/v1/webhooks/deliveries/:deliveryId/replay",
    async ({ params }) => {
      await applyMockConditions();
      const originalDelivery = mockDatabase.webhookDeliveries.find(
        (webhookDelivery) => webhookDelivery.id === params.deliveryId,
      );
      if (!originalDelivery) {
        return createNotFoundResponse("Delivery");
      }

      const replayedDelivery = {
        ...originalDelivery,
        id: createMockUlid(),
        trigger: "replay" as const,
        attempt: 1,
        status: "succeeded" as const,
        response: {
          status_code: 200,
          headers: { "content-type": "application/json" },
          body: '{"ok":true}',
          is_body_truncated: false,
        },
        error_message: null,
        next_attempt_at: null,
        created_at: new Date().toISOString(),
      };

      mockDatabase.webhookDeliveries.unshift(replayedDelivery);
      publishMockEvent("webhook.delivered", { id: replayedDelivery.id });

      return HttpResponse.json(replayedDelivery);
    },
  ),
];
