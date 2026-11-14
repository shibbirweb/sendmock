import { http } from "msw";

import { readMockConditions } from "@/mocks/conditions/mock-conditions";
import {
  createErrorResponse,
  createNotFoundResponse,
} from "@/mocks/handlers/handler-utils";

/**
 * The demo's "Always 500" and "Always 404" settings, applied before any
 * other handler so every endpoint honours them (18-design-review, UI-07.2).
 * The health check keeps answering, as a real server's would while one
 * endpoint fails. Returning nothing passes the request on.
 */
export const simulatedErrorHandler = http.all("*/api/v1/*", ({ request }) => {
  const { simulatedApiError } = readMockConditions();
  if (
    simulatedApiError === "none" ||
    new URL(request.url).pathname.endsWith("/api/v1/health")
  ) {
    return undefined;
  }

  return simulatedApiError === "server-error"
    ? createErrorResponse(500, "internal_error", "Simulated server error")
    : createNotFoundResponse("Resource");
});
