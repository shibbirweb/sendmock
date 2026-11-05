import { http, HttpResponse } from "msw";

import { applyMockConditions } from "@/mocks/handlers/handler-utils";

/** The mock's OpenAPI document, the same one the binary serves; loaded only when asked for. */
export const openApiHandlers = [
  http.get("*/api/openapi.json", async () => {
    await applyMockConditions();
    const { default: openApiDocument } =
      await import("@/mocks/generated/openapi-document.json");

    return HttpResponse.json(openApiDocument);
  }),
];
