import { http, HttpResponse } from "msw";

/** All mock API handlers. Resource handlers are added as each resource is built. */
export const mockHandlers = [
  http.get("*/api/v1/health", () => HttpResponse.json({ status: "ok" })),
];
