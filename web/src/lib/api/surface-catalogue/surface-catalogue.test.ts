import { describe, expect, test } from "vitest";

import { apiEndpoints } from "@/lib/api/endpoint-registry";
import { surfaceCatalogue } from "@/lib/api/surface-catalogue";

/** The only operations without an MCP tool: agents never read secrets back. */
const secretRevealOperations = [
  "GET /api/v1/webhooks/endpoints/{endpointId}/secret",
  "GET /api/v1/payments/gateways/{gatewayKey}/credentials/{credentialName}",
  "GET /api/v1/emails/providers/{providerKey}/credentials/{credentialName}",
  "GET /api/v1/sms/providers/{providerKey}/credentials/{credentialName}",
];

const registeredOperationKeys = apiEndpoints.map(
  (apiEndpoint) => `${apiEndpoint.method} ${apiEndpoint.path}`,
);
const catalogueEntries = Object.entries(surfaceCatalogue);

const stageBPhases = ["0", "1", "2", "3", "3P", "4"];

describe("surface catalogue", () => {
  test("UI-12.1 every operation names the phase it arrives in", () => {
    expect(
      catalogueEntries
        .filter(([, surfaces]) => !stageBPhases.includes(surfaces.phase))
        .map(([operationKey]) => operationKey),
      "operations without a phase",
    ).toEqual([]);
  });

  test("UI-11.1 every registry operation has a catalogue entry, and only those", () => {
    const catalogueKeys = new Set(Object.keys(surfaceCatalogue));

    expect(
      registeredOperationKeys.filter(
        (operationKey) => !catalogueKeys.has(operationKey),
      ),
      "operations without surfaces",
    ).toEqual([]);
    expect(
      [...catalogueKeys].filter(
        (catalogueKey) => !registeredOperationKeys.includes(catalogueKey),
      ),
      "surfaces without an operation",
    ).toEqual([]);
  });

  test("UI-11.1 every entry names a CLI command, an MCP tool or resource, and a UI place", () => {
    for (const [operationKey, operationSurfaces] of catalogueEntries) {
      expect(operationSurfaces.cli, operationKey).toMatch(/^sendmock [a-z]/);
      expect(operationSurfaces.ui.trim(), operationKey).not.toBe("");
      if (operationSurfaces.mcp === null) {
        expect(secretRevealOperations, operationKey).toContain(operationKey);
        expect(operationSurfaces.mcpExemptReason, operationKey).toBeTruthy();
      } else {
        expect(operationSurfaces.mcp, operationKey).toMatch(
          /^(sendmock_[a-z_]+|sendmock:\/\/\S+)$/,
        );
      }
    }
  });

  test("UI-11.1 the only operations without an MCP tool are the secret reveals", () => {
    const operationsWithoutTool = catalogueEntries
      .filter(([, operationSurfaces]) => operationSurfaces.mcp === null)
      .map(([operationKey]) => operationKey);

    expect(operationsWithoutTool.toSorted()).toEqual(
      secretRevealOperations.toSorted(),
    );
  });
});
