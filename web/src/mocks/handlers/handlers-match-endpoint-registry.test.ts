import { HttpHandler } from "msw";
import { describe, expect, test } from "vitest";

import { apiEndpoints } from "@/lib/api/endpoint-registry";
import { mockHandlers } from "@/mocks/handlers";

/** The capture route matches any method and path, so it is written as a wildcard. */
const captureHandlerPath = "*/catch/*";
const captureRegistryPath = "/catch/{binPath}";

/** "GET /api/v1/emails/:emailId", from a handler, with the host wildcard dropped. */
function listHandledEndpoints(): string[] {
  return mockHandlers
    .filter((mockHandler) => mockHandler instanceof HttpHandler)
    .filter((httpHandler) => typeof httpHandler.info.path === "string")
    .flatMap((httpHandler) => {
      const handlerPath = String(httpHandler.info.path);
      const handlerMethod = String(httpHandler.info.method);
      if (handlerPath === captureHandlerPath) {
        return apiEndpoints
          .filter((apiEndpoint) => apiEndpoint.path === captureRegistryPath)
          .map((apiEndpoint) => `${apiEndpoint.method} ${captureRegistryPath}`);
      }
      // The demo's simulated errors match every method and path (a RegExp
      // method); they are not an endpoint.
      if (!/^[A-Z]+$/.test(handlerMethod)) {
        return [];
      }

      return [`${handlerMethod} ${handlerPath.replace(/^\*/, "")}`];
    });
}

/** The same form from the registry: `{emailId}` becomes `:emailId`. */
function listRegisteredEndpoints(): string[] {
  return apiEndpoints.map((apiEndpoint) =>
    apiEndpoint.path === captureRegistryPath
      ? `${apiEndpoint.method} ${captureRegistryPath}`
      : `${apiEndpoint.method} ${apiEndpoint.path.replace(/\{(\w+)\}/g, ":$1")}`,
  );
}

describe("endpoint registry", () => {
  test("UI-09.1 lists every endpoint a mock handler answers, and only those", () => {
    const handledEndpoints = new Set(listHandledEndpoints());
    const registeredEndpoints = new Set(listRegisteredEndpoints());

    expect(
      [...handledEndpoints].filter(
        (handledEndpoint) => !registeredEndpoints.has(handledEndpoint),
      ),
      "handled but not in the registry",
    ).toEqual([]);
    expect(
      [...registeredEndpoints].filter(
        (registeredEndpoint) => !handledEndpoints.has(registeredEndpoint),
      ),
      "in the registry but no handler answers",
    ).toEqual([]);
  });

  test("UI-09.1 lists each method and path once", () => {
    const registeredEndpoints = listRegisteredEndpoints();

    expect(new Set(registeredEndpoints).size).toBe(registeredEndpoints.length);
  });

  test("every endpoint has a summary and every answer is described", () => {
    for (const apiEndpoint of apiEndpoints) {
      expect(apiEndpoint.summary, apiEndpoint.path).not.toBe("");
      if (apiEndpoint.response === null) {
        expect(apiEndpoint.successStatus, apiEndpoint.path).toBe(204);
      }
    }
  });
});
