import { http, HttpResponse } from "msw";

import { readMockConditions } from "@/mocks/conditions/mock-conditions";
import {
  applyMockConditions,
  createErrorResponse,
} from "@/mocks/handlers/handler-utils";

/** The mock's OpenAPI document, the same one the binary serves; loaded only when asked for. */
export const openApiHandlers = [
  http.get("*/api/openapi.json", async () => {
    await applyMockConditions();
    // The demo's "Always 500" and "Always 404" reach the document too (UI-07.2).
    const { simulatedApiError } = readMockConditions();
    if (simulatedApiError !== "none") {
      return simulatedApiError === "server-error"
        ? createErrorResponse(500, "internal_error", "Simulated server error")
        : createErrorResponse(404, "not_found", "Resource not found");
    }
    const { default: openApiDocument } =
      await import("@/mocks/generated/openapi-document.json");

    return HttpResponse.json(openApiDocument);
  }),
];
