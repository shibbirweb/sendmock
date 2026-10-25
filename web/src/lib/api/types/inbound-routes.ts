import type { IsoTimestamp, Ulid } from "@/lib/api/types/common";

/** Which incoming emails a route takes (Mailgun's filters, WH-12). */
export type InboundRouteFilter =
  | { kind: "match_recipient"; pattern: string }
  | { kind: "match_header"; header_name: string; pattern: string }
  | { kind: "catch_all" };

/** What a route does with a matching email, in order. */
export type InboundRouteAction =
  | { kind: "forward_url"; url: string }
  | { kind: "forward_email"; address: string }
  | { kind: "store"; notify_url: string | null }
  | { kind: "stop" };

/** A Mailgun-style inbound route (WH-12.7). */
export type InboundRoute = {
  id: Ulid;
  /** Lower runs first. */
  priority: number;
  description: string;
  filter: InboundRouteFilter;
  /** The filter in Mailgun syntax, e.g. `match_recipient("support@.*")`. */
  expression: string;
  actions: InboundRouteAction[];
  /** Each action in Mailgun syntax, e.g. `forward("http://...")`. */
  action_expressions: string[];
  created_at: IsoTimestamp;
};

/** Body of POST /api/v1/inbound-routes and PATCH /api/v1/inbound-routes/{routeId}. */
export type InboundRouteInput = Pick<
  InboundRoute,
  "priority" | "description" | "filter" | "actions"
>;

/** Body of POST /api/v1/inbound-routes/test: a filter to try on recent incoming emails. */
export type InboundRouteTestRequest = { filter: InboundRouteFilter };

export type InboundRouteMatch = {
  email_id: Ulid;
  from: string;
  /** The recipient or header value that matched. */
  matched_value: string;
  subject: string;
  /** Named groups, usable in actions as `\g<name>`. */
  captured_groups: Record<string, string>;
};

export type InboundRouteTestResult = {
  /** How many recent incoming emails were checked (at most 50). */
  checked_count: number;
  matches: InboundRouteMatch[];
};
