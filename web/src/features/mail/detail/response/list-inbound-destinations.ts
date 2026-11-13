import type {
  InboundRouteAction,
  InboundRouteMatchResult,
  MatchedInboundRoute,
} from "@/lib/api/types";

export type InboundDestination = {
  key: string;
  /** The URL or address that receives the email, or "Stored only". */
  target: string;
  /** "Route Ticket replies" or "Rule Replies to my app". */
  sourceLabel: string;
  source:
    { kind: "route"; routeId: string } | { kind: "rule"; endpointId: string };
};

function describeActionTarget(routeAction: InboundRouteAction): string | null {
  switch (routeAction.kind) {
    case "forward_url":
      return routeAction.url;
    case "forward_email":
      return `${routeAction.address} (release allowlist)`;
    case "store":
      return routeAction.notify_url ?? "Stored only";
    case "stop":
      return null;
  }
}

function listRouteDestinations(
  matchedRoute: MatchedInboundRoute,
): InboundDestination[] {
  const sourceLabel = `Route ${matchedRoute.description || matchedRoute.expression}`;

  return matchedRoute.actions.flatMap((routeAction, actionIndex) => {
    const target = describeActionTarget(routeAction);

    return target === null
      ? []
      : [
          {
            key: `route-${matchedRoute.route_id}-${actionIndex}`,
            target,
            sourceLabel,
            source: { kind: "route", routeId: matchedRoute.route_id },
          },
        ];
  });
}

/**
 * What will receive the incoming email, in the order it happens: each route's
 * forwards and notifications, then each webhook rule's endpoint (EM-22.3).
 */
export function listInboundDestinations(
  matchResult: InboundRouteMatchResult,
): InboundDestination[] {
  return [
    ...matchResult.routes.flatMap(listRouteDestinations),
    ...matchResult.webhook_rules.map((matchedRule): InboundDestination => ({
      key: `rule-${matchedRule.rule_id}`,
      target: matchedRule.endpoint_url,
      sourceLabel: `Rule ${matchedRule.rule_name}`,
      source: { kind: "rule", endpointId: matchedRule.endpoint_id },
    })),
  ];
}
