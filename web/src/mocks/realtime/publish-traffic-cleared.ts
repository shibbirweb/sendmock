import { publishMockEvent } from "@/mocks/realtime/mock-event-bus";

/** What a delete all removed, as `traffic.cleared` names it (docs/plan/06-api.md). */
export type ClearedTrafficKind =
  | "email"
  | "sms"
  | "verification"
  | "push"
  | "http_request"
  | "webhook_delivery"
  | "payment"
  | "subscription"
  | "smtp_session"
  | "api_request";

/** One event for a whole delete all, so open tabs refresh their lists once. */
export function publishTrafficCleared(
  clearedKinds: ClearedTrafficKind[],
  projectKey: string | null,
  deletedCount: number,
) {
  publishMockEvent("traffic.cleared", {
    kinds: clearedKinds,
    project: projectKey,
    deleted_count: deletedCount,
  });
}

/** The `project` query value, or null when the request covers every project. */
export function readRequestedProjectKey(
  searchParameters: URLSearchParams,
): string | null {
  const projectKey = searchParameters.get("project");

  return projectKey === null || projectKey === "" ? null : projectKey;
}
