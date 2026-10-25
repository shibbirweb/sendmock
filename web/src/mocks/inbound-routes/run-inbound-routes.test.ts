import { describe, expect, test } from "vitest";

import { createMockDatabase } from "@/mocks/db/mock-database";
import { runInboundRoutes } from "@/mocks/inbound-routes/run-inbound-routes";

function setUpIncomingEmail(recipient: string) {
  const mockDatabase = createMockDatabase("standard");
  const incomingEmail = mockDatabase.emails.find(
    (email) => email.direction === "inbound",
  );
  if (incomingEmail === undefined) {
    throw new Error("The fixtures need an incoming email.");
  }
  incomingEmail.to = [{ name: "", address: recipient }];

  return { mockDatabase, incomingEmail };
}

describe("runInboundRoutes", () => {
  test("WH-12.7 the first matching route forwards with its captured group, then stops", () => {
    const { mockDatabase, incomingEmail } = setUpIncomingEmail(
      "reply+T-1042@reply.app.test",
    );
    const routeDeliveries = runInboundRoutes(mockDatabase, incomingEmail);

    expect(routeDeliveries).toHaveLength(1);
    expect(routeDeliveries[0]).toMatchObject({
      endpoint_name: "Route: Ticket replies to Laravel",
      event_type: "email.inbound",
      subject_id: incomingEmail.id,
      status: "succeeded",
      request: { url: "http://localhost:8000/webhooks/mail/tickets/T-1042" },
    });
    expect(routeDeliveries[0]?.request?.body).toContain('name="recipient"');
    expect(routeDeliveries[0]?.request?.body).toContain(
      "reply+T-1042@reply.app.test",
    );
    expect(mockDatabase.webhookDeliveries[0]).toBe(routeDeliveries[0]);
    expect(
      mockDatabase.emailTimelines.get(incomingEmail.id)?.at(-1)?.detail,
    ).toBe(
      "Forwarded by route Ticket replies to Laravel to http://localhost:8000/webhooks/mail/tickets/T-1042 (200)",
    );
  });

  test("WH-12.7 without stop() every matching route runs in priority order", () => {
    const { mockDatabase, incomingEmail } =
      setUpIncomingEmail("no-reply@acme.test");
    const routeDeliveries = runInboundRoutes(mockDatabase, incomingEmail);

    expect(
      routeDeliveries.map((routeDelivery) => routeDelivery.endpoint_name),
    ).toEqual(["Route: Replies to no-reply", "Route: Keep everything else"]);
    expect(routeDeliveries[1]?.request?.body).toContain('name="message-url"');
  });

  test("WH-12.7 forward to an email only goes to addresses on the release allowlist", () => {
    const { mockDatabase, incomingEmail } =
      setUpIncomingEmail("someone@else.test");
    mockDatabase.inboundRoutes = [
      {
        id: "route",
        priority: 0,
        description: "To the team",
        filter: { kind: "catch_all" },
        actions: [{ kind: "forward_email", address: "dev@company.com" }],
        created_at: new Date().toISOString(),
      },
    ];
    runInboundRoutes(mockDatabase, incomingEmail);
    expect(
      mockDatabase.emailTimelines.get(incomingEmail.id)?.at(-1)?.detail,
    ).toBe(
      "Not forwarded to dev@company.com: not on the release allowlist (route To the team)",
    );

    mockDatabase.settings.relay_recipient_allowlist = ["*@company.com"];
    runInboundRoutes(mockDatabase, incomingEmail);
    expect(
      mockDatabase.emailTimelines.get(incomingEmail.id)?.at(-1)?.detail,
    ).toBe("Forwarded by route To the team to dev@company.com");
  });
});
