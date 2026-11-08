import { describe, expect, test } from "vitest";

import { apiEndpoints } from "@/lib/api/endpoint-registry";
import { buildOperationId } from "@/lib/api/endpoint-registry/operation-id";
import { buildMockAppInfo } from "@/mocks/handlers/system-handlers";

describe("mock /info", () => {
  test("UI-12.3 the demo reports every operation as available, so it shows no Not available yet", () => {
    const servedOperationIds = new Set(buildMockAppInfo().available_operations);

    expect(
      apiEndpoints
        .map((apiEndpoint) =>
          buildOperationId(apiEndpoint.method, apiEndpoint.path),
        )
        .filter((operationId) => !servedOperationIds.has(operationId)),
    ).toEqual([]);
  });
});
