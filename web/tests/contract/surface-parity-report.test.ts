import { describe, expect, test } from "bun:test";

import type { ApiEndpoint } from "../../src/lib/api/endpoint-registry";
import type { SurfaceCatalogue } from "../../src/lib/api/surface-catalogue";
import {
  buildSurfaceParityReport,
  formatSurfaceParityReport,
} from "../../scripts/surfaces/surface-parity-report";

function endpoint(method: ApiEndpoint["method"], path: string): ApiEndpoint {
  return {
    method,
    path,
    summary: "An operation.",
    tag: "Email",
    response: null,
  };
}

const completeSurfaces = {
  cli: "sendmock email list",
  mcp: "sendmock_email_list",
  ui: "Mail",
};

describe("surface parity report", () => {
  test("UI-11.7 a complete catalogue has no gaps and counts every way", () => {
    const report = buildSurfaceParityReport(
      [endpoint("GET", "/api/v1/emails")],
      { "GET /api/v1/emails": completeSurfaces },
    );

    expect(report.gaps).toEqual([]);
    expect(report.areas).toEqual([
      {
        area: "Email",
        operationCount: 1,
        cliCount: 1,
        mcpCount: 1,
        mcpExemptCount: 0,
        uiCount: 1,
      },
    ]);
    expect(formatSurfaceParityReport(report)).toContain(
      "Every one of the 1 operations has REST, CLI, MCP and UI.",
    );
  });

  test("UI-11.7 a missing CLI command, MCP tool, UI place or operation is a gap", () => {
    const catalogue: SurfaceCatalogue = {
      "GET /api/v1/emails": { ...completeSurfaces, cli: "" },
      "DELETE /api/v1/emails": { ...completeSurfaces, mcp: null },
      "POST /api/v1/send": { ...completeSurfaces, ui: " " },
      "GET /api/v1/gone": completeSurfaces,
    };
    const report = buildSurfaceParityReport(
      [
        endpoint("GET", "/api/v1/emails"),
        endpoint("DELETE", "/api/v1/emails"),
        endpoint("POST", "/api/v1/send"),
        endpoint("GET", "/api/v1/emails/latest"),
      ],
      catalogue,
    );

    expect(report.gaps).toEqual([
      { operationKey: "GET /api/v1/emails", problem: "no CLI command" },
      {
        operationKey: "DELETE /api/v1/emails",
        problem: "no MCP tool and no exemption reason",
      },
      { operationKey: "POST /api/v1/send", problem: "no UI place" },
      {
        operationKey: "GET /api/v1/emails/latest",
        problem: "no CLI command, MCP tool or UI place",
      },
      {
        operationKey: "GET /api/v1/gone",
        problem: "in the catalogue but not a REST operation",
      },
    ]);
    expect(formatSurfaceParityReport(report)).toContain("5 gap(s) found.");
  });

  test("UI-11.7 an exemption with a reason counts as covered", () => {
    const report = buildSurfaceParityReport(
      [endpoint("GET", "/api/v1/webhooks/endpoints/{endpointId}/secret")],
      {
        "GET /api/v1/webhooks/endpoints/{endpointId}/secret": {
          ...completeSurfaces,
          mcp: null,
          mcpExemptReason: "Agents never read secrets back.",
        },
      },
    );

    expect(report.gaps).toEqual([]);
    expect(formatSurfaceParityReport(report)).toContain("0 + 1 exempt");
  });
});
