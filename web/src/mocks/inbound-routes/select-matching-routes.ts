import {
  matchRouteFilter,
  type RoutableEmail,
} from "@/lib/inbound-routes/match-route-filter";
import type { InboundRouteRecord } from "@/mocks/fixtures/inbound-route-fixtures";
import { sortRoutesByPriority } from "@/mocks/inbound-routes/inbound-route-record";

export type SelectedRoute = {
  routeRecord: InboundRouteRecord;
  matchedValue: string;
  capturedGroups: Record<string, string>;
};

/**
 * The routes that take the email, in priority order, ending at the first that
 * calls `stop()`. A real incoming email and the match preview both read this,
 * so the preview never disagrees with what runs (EM-22.2).
 */
export function selectMatchingRoutes(
  routeRecords: InboundRouteRecord[],
  routableEmail: RoutableEmail,
): SelectedRoute[] {
  const selectedRoutes: SelectedRoute[] = [];
  for (const routeRecord of sortRoutesByPriority(routeRecords)) {
    const filterMatch = matchRouteFilter(routeRecord.filter, routableEmail);
    if (!filterMatch.isMatch) {
      continue;
    }
    selectedRoutes.push({
      routeRecord,
      matchedValue: filterMatch.matchedValue,
      capturedGroups: filterMatch.capturedGroups,
    });
    if (
      routeRecord.actions.some((routeAction) => routeAction.kind === "stop")
    ) {
      break;
    }
  }

  return selectedRoutes;
}
