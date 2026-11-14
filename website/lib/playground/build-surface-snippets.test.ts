import { describe, expect, test } from "bun:test";

import {
  buildCliSnippet,
  buildMcpSnippet,
  type CliSnippetSource,
  type McpSnippetSource,
  type SnippetFormValues,
} from "./build-surface-snippets";

const emailUpdateCli: CliSnippetSource = {
  usage: "sendmock email update <emailId> [flags]",
  url: "/cli/email/#email-update",
  arguments: [
    {
      name: "emailId",
      input: { name: "emailId", location: "path" },
      example: "01JB",
      reads_file: false,
    },
  ],
  flags: [
    {
      flag: "--read",
      input: { name: "is_read", location: "body" },
      value_label: null,
      is_repeatable: false,
      takes_json: false,
      example: true,
    },
    {
      flag: "--tag",
      input: { name: "tags", location: "body" },
      value_label: "<tag>",
      is_repeatable: true,
      takes_json: false,
      example: ["a"],
    },
  ],
  selectorValue: null,
};

const formValues: SnippetFormValues = {
  pathValues: { emailId: "01JTEST" },
  queryValues: {},
  bodyObject: { is_read: false, tags: ["signup", "needs review"] },
  rawBody: null,
};

describe("CLI and MCP snippets", () => {
  test("WS-04.6 the CLI snippet fills arguments and turns body fields into flags", () => {
    expect(buildCliSnippet(emailUpdateCli, formValues)).toBe(
      "sendmock email update 01JTEST --no-read --tag signup --tag 'needs review'",
    );
  });

  test("WS-04.6 a long CLI snippet puts each flag on its own line", () => {
    const longValues = {
      ...formValues,
      bodyObject: {
        tags: ["one-long-tag-name", "another-long-tag-name", "third"],
      },
    };

    expect(buildCliSnippet(emailUpdateCli, longValues)).toBe(
      [
        "sendmock email update 01JTEST \\",
        "  --tag one-long-tag-name --tag another-long-tag-name --tag third",
      ].join("\n"),
    );
  });

  test("WS-04.6 an inline flag and a selector take the form's and the operation's values", () => {
    const otpCli: CliSnippetSource = {
      usage: "sendmock otp --to <recipient> [flags]",
      url: "/cli/test-helpers/#otp",
      arguments: [],
      flags: [
        {
          flag: "--to",
          input: { name: "to", location: "query" },
          value_label: "<recipient>",
          is_repeatable: false,
          takes_json: false,
          example: "a",
        },
        {
          flag: "--wait",
          input: { name: "timeout", location: "query" },
          value_label: "<wait>",
          is_repeatable: false,
          takes_json: false,
          example: "10s",
        },
      ],
      selectorValue: null,
    };

    expect(
      buildCliSnippet(otpCli, {
        ...formValues,
        queryValues: { to: "user@example.test", timeout: "5s" },
      }),
    ).toBe("sendmock otp --to user@example.test --wait 5s");
  });

  test("WS-04.6 the MCP snippet names the tool and types its arguments", () => {
    const listTool: McpSnippetSource = {
      kind: "tool",
      name: "sendmock_email_check",
      url: "/mcp/email/#sendmock_email_check",
      properties: [
        { name: "kind", input: null, type: "string" },
        {
          name: "email_id",
          input: { name: "emailId", location: "path" },
          type: "string",
        },
        {
          name: "limit",
          input: { name: "limit", location: "query" },
          type: "integer",
        },
      ],
      selectorValue: "html",
    };

    expect(
      JSON.parse(
        buildMcpSnippet(listTool, {
          ...formValues,
          queryValues: { limit: "20" },
        }),
      ),
    ).toEqual({
      name: "sendmock_email_check",
      arguments: { kind: "html", email_id: "01JTEST", limit: 20 },
    });
  });

  test("WS-04.6 a resource is read by its URI with the path values filled in", () => {
    const rawResource: McpSnippetSource = {
      kind: "resource",
      uri: "sendmock://emails/{emailId}/raw",
      url: "/mcp/email/#resource-emails-emailid-raw",
    };

    expect(JSON.parse(buildMcpSnippet(rawResource, formValues))).toEqual({
      method: "resources/read",
      params: { uri: "sendmock://emails/01JTEST/raw" },
    });
  });
});
