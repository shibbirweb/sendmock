import type { InboundRouteInput } from "@/lib/api/types";

/** What the mock stores; the Mailgun expressions are worked out when presented. */
export type InboundRouteRecord = InboundRouteInput & {
  id: string;
  created_at: string;
};

const routeSpecs: InboundRouteInput[] = [
  {
    priority: 0,
    description: "Ticket replies to Laravel",
    filter: {
      kind: "match_recipient",
      pattern: "reply\\+(?P<token>[\\w-]+)@reply\\.app\\.test",
    },
    actions: [
      {
        kind: "forward_url",
        url: "http://localhost:8000/webhooks/mail/tickets/\\g<token>",
      },
      { kind: "stop" },
    ],
  },
  {
    priority: 10,
    description: "Replies to no-reply",
    filter: { kind: "match_recipient", pattern: "no-reply@acme\\.test" },
    actions: [
      {
        kind: "forward_url",
        url: "http://localhost:8000/webhooks/mail/inbound",
      },
    ],
  },
  {
    priority: 100,
    description: "Keep everything else",
    filter: { kind: "catch_all" },
    actions: [
      {
        kind: "store",
        notify_url: "http://localhost:8000/webhooks/mail/stored",
      },
    ],
  },
];

/** Demo routes in the shape apps create with Mailgun's Routes API (WH-12). */
export function buildInboundRouteFixtures(): InboundRouteRecord[] {
  return routeSpecs.map((routeSpec, routeIndex) => ({
    ...structuredClone(routeSpec),
    // Fixed ids: fixtures built before the mailbox must not use the seeded randomness.
    id: `01JB7R0UTE00000000000000${routeIndex + 10}`,
    created_at: new Date(
      Date.now() - (routeSpecs.length - routeIndex) * 60_000,
    ).toISOString(),
  }));
}
