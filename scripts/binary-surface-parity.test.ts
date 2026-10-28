import { describe, expect, test } from "bun:test";

import {
  type BinarySurfaces,
  type CatalogueSurfaces,
  compareSurfaces,
} from "./binary-surface-parity";

const healthSelector = { input: "view", value: "health" };

const catalogue: CatalogueSurfaces = {
  commands: [
    {
      command: "sendmock health",
      usage: "sendmock health",
      operations: [{ operation_id: "getHealth", selector: healthSelector }],
      mcp: ["sendmock_status"],
    },
    {
      command: "sendmock email list",
      usage: "sendmock email list",
      operations: [{ operation_id: "getEmails", selector: null }],
      mcp: ["sendmock_email_list"],
    },
  ],
  tools: [
    {
      name: "sendmock_status",
      operations: [{ operation_id: "getHealth", selector: healthSelector }],
      annotations: {
        read_only_hint: true,
        destructive_hint: false,
        idempotent_hint: false,
      },
    },
  ],
};

function binaryWith(usage: string, toolName: string): BinarySurfaces {
  return {
    commands: [
      {
        command: "sendmock serve",
        usage: "sendmock serve",
        operations: [],
        mcp: [],
      },
      {
        command: usage,
        usage,
        operations: [{ operation_id: "getHealth", selector: healthSelector }],
        mcp: [toolName],
      },
    ],
    mcp_tools: [
      {
        name: toolName,
        operationIds: ["getHealth"],
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
        },
      },
    ],
  };
}

describe("compareSurfaces", () => {
  test("passes when the binary names its commands and tools as the catalogue does", () => {
    const report = compareSurfaces(
      binaryWith("sendmock health", "sendmock_status"),
      catalogue,
    );

    expect(report.mismatches).toEqual([]);
    expect(report.implementedOperationIds).toEqual(["getHealth"]);
    expect(report.plannedCommandCount).toBe(1);
  });

  test("fails when the binary's command differs from the catalogue", () => {
    const report = compareSurfaces(
      binaryWith("sendmock ping", "sendmock_status"),
      catalogue,
    );

    expect(report.mismatches).toEqual([
      'getHealth: the binary\'s command is "sendmock ping", the catalogue\'s "sendmock health"',
    ]);
  });

  test("fails when the binary has a tool the catalogue does not list", () => {
    const report = compareSurfaces(
      binaryWith("sendmock health", "sendmock_ping"),
      catalogue,
    );

    expect(report.mismatches).toContain(
      "MCP tool sendmock_ping is not in the catalogue",
    );
  });
});
