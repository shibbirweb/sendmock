import type {
  InboundRouteAction,
  InboundRouteMatchRequest,
  InboundRouteMatchResult,
} from "@/lib/api/types";
import { fillCapturedGroups } from "@/lib/inbound-routes/match-route-filter";
import {
  toActionExpression,
  toRouteExpression,
} from "@/lib/inbound-routes/route-expressions";
import { mockDatabase } from "@/mocks/db/mock-database";
import { buildEmailFixture } from "@/mocks/fixtures/email-fixture-builder";
import { parseEmailAddress } from "@/mocks/handlers/handler-utils";
import { toRoutableEmail } from "@/mocks/inbound-routes/inbound-route-record";
import { selectMatchingRoutes } from "@/mocks/inbound-routes/select-matching-routes";
import { findFiringRules } from "@/mocks/webhooks/fire-matching-rules";

function readHeader(
  headers: Record<string, string>,
  headerName: string,
): string | null {
  const headerEntry = Object.entries(headers).find(
    ([existingName]) => existingName.toLowerCase() === headerName,
  );

  return headerEntry?.[1] ?? null;
}

/** The email about to arrive, as routes and rule filters read a stored one. */
function buildIncomingPreview(matchRequest: InboundRouteMatchRequest) {
  const headers = matchRequest.headers ?? {};
  const previewFixture = buildEmailFixture({
    minutesAgo: 0,
    from: parseEmailAddress(readHeader(headers, "from") ?? ""),
    to: matchRequest.to.map(parseEmailAddress),
    subject: readHeader(headers, "subject") ?? "",
    textBody: "",
  });

  return {
    ...previewFixture.email,
    cc: (matchRequest.cc ?? []).map(parseEmailAddress),
    headers: Object.fromEntries(
      Object.entries(headers).map(([headerName, headerValue]) => [
        headerName,
        [headerValue],
      ]),
    ),
    direction: "inbound" as const,
  };
}

function fillActionGroups(
  routeAction: InboundRouteAction,
  capturedGroups: Record<string, string>,
): InboundRouteAction {
  switch (routeAction.kind) {
    case "forward_url":
      return {
        ...routeAction,
        url: fillCapturedGroups(routeAction.url, capturedGroups),
      };
    case "forward_email":
      return {
        ...routeAction,
        address: fillCapturedGroups(routeAction.address, capturedGroups),
      };
    case "store":
      return {
        ...routeAction,
        notify_url:
          routeAction.notify_url === null
            ? null
            : fillCapturedGroups(routeAction.notify_url, capturedGroups),
      };
    case "stop":
      return routeAction;
  }
}

/**
 * Where an incoming email would go, with the same route and rule matching a
 * real one runs; nothing is stored or sent (EM-22.2).
 */
export function matchInboundRoutes(
  matchRequest: InboundRouteMatchRequest,
): InboundRouteMatchResult {
  const incomingPreview = buildIncomingPreview(matchRequest);
  const selectedRoutes = selectMatchingRoutes(
    mockDatabase.inboundRoutes,
    toRoutableEmail(incomingPreview),
  );

  return {
    routes: selectedRoutes.map(
      ({ routeRecord, matchedValue, capturedGroups }) => {
        const actions = routeRecord.actions.map((routeAction) =>
          fillActionGroups(routeAction, capturedGroups),
        );

        return {
          route_id: routeRecord.id,
          priority: routeRecord.priority,
          description: routeRecord.description,
          expression: toRouteExpression(routeRecord.filter),
          matched_value: matchedValue,
          actions,
          action_expressions: actions.map(toActionExpression),
          calls_stop: actions.some(
            (routeAction) => routeAction.kind === "stop",
          ),
        };
      },
    ),
    webhook_rules: findFiringRules("email.inbound", {
      messageKind: "email",
      email: incomingPreview,
    }).map(({ webhookRule, endpointRecord }) => ({
      rule_id: webhookRule.id,
      rule_name: webhookRule.name,
      endpoint_id: endpointRecord.id,
      endpoint_name: endpointRecord.name,
      endpoint_url: endpointRecord.url,
    })),
  };
}
