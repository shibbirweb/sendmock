import { http, HttpResponse } from "msw";

import { mockDatabase } from "@/mocks/db/mock-database";
import { applyMockConditions } from "@/mocks/handlers/handler-utils";

/** Read-only list endpoints that return a whole collection. */
const collectionRoutes = {
  "*/api/v1/webhooks/templates": () => mockDatabase.webhookTemplates,
};

const collectionHandlers = Object.entries(collectionRoutes).map(
  ([routePath, readCollection]) =>
    http.get(routePath, async () => {
      const conditionResponse = await applyMockConditions();

      return conditionResponse ?? HttpResponse.json(readCollection());
    }),
);

export const webhookHandlers = [...collectionHandlers];
