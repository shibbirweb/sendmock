import { beforeEach, describe, expect, test } from "vitest";

import { mockDatabase, replaceMockDatabase } from "@/mocks/db/mock-database";
import { matchInboundRoutes } from "@/mocks/inbound-routes/match-inbound-routes";

beforeEach(() => {
  replaceMockDatabase("empty");
});

function addInboundRule(subjectWord: string) {
  const firstEndpoint = mockDatabase.webhookEndpoints[0];
  if (firstEndpoint === undefined) {
    throw new Error("The fixtures need a webhook endpoint.");
  }
  mockDatabase.webhookRules.push({
    id: `rule-${subjectWord}`,
    name: `Replies about ${subjectWord}`,
    endpoint_id: firstEndpoint.id,
    events: ["email.inbound"],
    filter: { field: "subject", operator: "contains", value: subjectWord },
    is_enabled: true,
    order: 10,
    created_by: "ui",
  });

  return firstEndpoint;
}

describe("matchInboundRoutes", () => {
  test("EM-22.2 names the routes up to stop() with groups filled, and the inbound rules that pass", () => {
    const appEndpoint = addInboundRule("receipt");
    addInboundRule("invoice");

    const matchResult = matchInboundRoutes({
      to: ["Help desk <reply+T-7@reply.app.test>"],
      headers: { subject: "Re: Your receipt", from: "sam@example.test" },
    });

    expect(matchResult.routes).toHaveLength(1);
    expect(matchResult.routes[0]).toMatchObject({
      description: "Ticket replies to Laravel",
      matched_value: "reply+T-7@reply.app.test",
      calls_stop: true,
      actions: [
        {
          kind: "forward_url",
          url: "http://localhost:8000/webhooks/mail/tickets/T-7",
        },
        { kind: "stop" },
      ],
    });
    expect(matchResult.webhook_rules).toEqual([
      {
        rule_id: "rule-receipt",
        rule_name: "Replies about receipt",
        endpoint_id: appEndpoint.id,
        endpoint_name: appEndpoint.name,
        endpoint_url: appEndpoint.url,
      },
    ]);
  });

  test("EM-22.2 a route without stop() lets the later ones run, and nothing is stored", () => {
    const emailCount = mockDatabase.emails.length;
    const deliveryCount = mockDatabase.webhookDeliveries.length;

    const matchResult = matchInboundRoutes({
      to: ["no-reply@acme.test"],
      cc: ["lee@example.test"],
    });

    expect(matchResult.routes.map((route) => route.description)).toEqual([
      "Replies to no-reply",
      "Keep everything else",
    ]);
    expect(mockDatabase.emails).toHaveLength(emailCount);
    expect(mockDatabase.webhookDeliveries).toHaveLength(deliveryCount);
  });

  test("EM-22.4 nothing matches once the routes are gone", () => {
    mockDatabase.inboundRoutes = [];

    expect(matchInboundRoutes({ to: ["support@inbound.app.test"] })).toEqual({
      routes: [],
      webhook_rules: [],
    });
  });
});
