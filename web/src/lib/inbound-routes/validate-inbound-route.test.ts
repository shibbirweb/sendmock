import { describe, expect, test } from "vitest";

import { validateInboundRoute } from "@/lib/inbound-routes/validate-inbound-route";

describe("validateInboundRoute", () => {
  test("WH-12.7 accepts a route with a captured group in its forward URL", () => {
    expect(
      validateInboundRoute({
        priority: 0,
        description: "Ticket replies",
        filter: {
          kind: "match_recipient",
          pattern: "reply\\+(?P<token>.+)@x\\.test",
        },
        actions: [
          {
            kind: "forward_url",
            url: "http://localhost:8000/tickets/\\g<token>",
          },
          { kind: "stop" },
        ],
      }),
    ).toEqual({});
  });

  test("WH-12.7 names each problem: priority, pattern, header and actions", () => {
    expect(
      validateInboundRoute({
        priority: -1,
        description: "",
        filter: { kind: "match_header", header_name: " ", pattern: "(" },
        actions: [
          { kind: "forward_url", url: "ftp://files" },
          { kind: "forward_email", address: "nobody" },
          { kind: "store", notify_url: "not a url" },
        ],
      }),
    ).toEqual({
      priority: "Use a whole number from 0 to 32767",
      pattern: "Not a valid regular expression",
      header_name: "Enter the header name, e.g. subject",
      "actions.0": "Enter an http or https URL",
      "actions.1": "Enter an email address",
      "actions.2": "Enter an http or https URL, or leave it empty",
    });
    expect(
      validateInboundRoute({
        priority: 1,
        description: "",
        filter: { kind: "catch_all" },
        actions: [],
      }),
    ).toEqual({ actions: "Add at least one action" });
  });
});
