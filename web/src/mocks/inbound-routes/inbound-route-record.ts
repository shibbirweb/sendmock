import type {
  EmailDetail,
  InboundRoute,
  InboundRouteFilter,
  InboundRouteTestResult,
} from "@/lib/api/types";
import {
  matchRouteFilter,
  type RoutableEmail,
} from "@/lib/inbound-routes/match-route-filter";
import {
  toActionExpression,
  toRouteExpression,
} from "@/lib/inbound-routes/route-expressions";
import type { InboundRouteRecord } from "@/mocks/fixtures/inbound-route-fixtures";

const recentEmailLimit = 50;

/** A stored route with its filter and actions in Mailgun syntax (WH-12.7). */
export function presentInboundRoute(
  routeRecord: InboundRouteRecord,
): InboundRoute {
  return {
    ...structuredClone(routeRecord),
    expression: toRouteExpression(routeRecord.filter),
    action_expressions: routeRecord.actions.map(toActionExpression),
  };
}

/** Lower priority first, then the older route, as Mailgun runs them. */
export function sortRoutesByPriority(
  routeRecords: InboundRouteRecord[],
): InboundRouteRecord[] {
  return [...routeRecords].sort(
    (firstRoute, secondRoute) =>
      firstRoute.priority - secondRoute.priority ||
      firstRoute.created_at.localeCompare(secondRoute.created_at),
  );
}

/** Recipients and headers of an email, as a route filter reads them. */
export function toRoutableEmail(email: EmailDetail): RoutableEmail {
  return {
    recipients: [...email.to, ...email.cc].map(
      (recipient) => recipient.address,
    ),
    headers: {
      ...email.headers,
      Subject: email.headers.Subject ?? [email.subject],
      From: email.headers.From ?? [email.from.address],
    },
  };
}

/** A filter tried on the last 50 incoming emails, with the groups each captured (WH-12.7). */
export function testRouteFilter(
  emails: EmailDetail[],
  routeFilter: InboundRouteFilter,
): InboundRouteTestResult {
  const recentIncoming = emails
    .filter((email) => email.direction === "inbound")
    .slice(0, recentEmailLimit);

  return {
    checked_count: recentIncoming.length,
    matches: recentIncoming.flatMap((email) => {
      const filterMatch = matchRouteFilter(routeFilter, toRoutableEmail(email));
      return filterMatch.isMatch
        ? [
            {
              email_id: email.id,
              from: email.from.address,
              matched_value: filterMatch.matchedValue,
              subject: email.subject,
              captured_groups: filterMatch.capturedGroups,
            },
          ]
        : [];
    }),
  };
}
