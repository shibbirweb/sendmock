import { describe, expect, test } from "vitest";

import { listInboundDestinations } from "@/features/mail/detail/response/list-inbound-destinations";
import { buildQuickRouteInput } from "@/features/mail/detail/response/send-replies-to-app-form";
import { validateInboundRoute } from "@/lib/inbound-routes/validate-inbound-route";

describe("listInboundDestinations", () => {
  test("EM-22.3 lists each route target in run order, then each rule's endpoint", () => {
    const destinations = listInboundDestinations({
      routes: [
        {
          route_id: "route-1",
          priority: 1,
          description: "Ticket replies",
          expression: 'match_recipient("reply\\+.*")',
          matched_value: "reply+7@reply.app.test",
          actions: [
            { kind: "forward_url", url: "http://localhost:8000/tickets/7" },
            { kind: "store", notify_url: null },
            { kind: "stop" },
          ],
          action_expressions: [],
          calls_stop: true,
        },
      ],
      webhook_rules: [
        {
          rule_id: "rule-1",
          rule_name: "Replies to my app",
          endpoint_id: "endpoint-1",
          endpoint_name: "Local app",
          endpoint_url: "http://localhost:3000/hooks",
        },
      ],
    });

    expect(
      destinations.map((destination) => [
        destination.target,
        destination.sourceLabel,
      ]),
    ).toEqual([
      ["http://localhost:8000/tickets/7", "Route Ticket replies"],
      ["Stored only", "Route Ticket replies"],
      ["http://localhost:3000/hooks", "Rule Replies to my app"],
    ]);
    expect(destinations[2]?.source).toEqual({
      kind: "rule",
      endpointId: "endpoint-1",
    });
  });
});

describe("buildQuickRouteInput", () => {
  test("EM-22.4 Only mail to the address makes an exact match_recipient route to the URL", () => {
    const routeInput = buildQuickRouteInput(
      " http://localhost:8000/webhooks/mail ",
      "recipient",
      "support@shop.test",
    );

    expect(routeInput.filter).toEqual({
      kind: "match_recipient",
      pattern: "^support@shop\\.test$",
    });
    expect(routeInput.actions).toEqual([
      { kind: "forward_url", url: "http://localhost:8000/webhooks/mail" },
    ]);
    expect(validateInboundRoute(routeInput)).toEqual({});
  });

  test("EM-22.4 Every incoming email makes a catch_all route and a bad URL is refused", () => {
    const routeInput = buildQuickRouteInput(
      "localhost:8000",
      "every_email",
      "support@shop.test",
    );

    expect(routeInput.filter).toEqual({ kind: "catch_all" });
    expect(validateInboundRoute(routeInput)["actions.0"]).toBeDefined();
  });
});
