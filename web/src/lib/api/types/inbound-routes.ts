import type { IsoTimestamp, Ulid } from "@/lib/api/types/common";
import type { MatchedWebhookRule } from "@/lib/api/types/webhook-rules";

/** Which incoming emails a route takes (Mailgun's filters, WH-12). */
export type InboundRouteFilter =
  | {
      /** A regular expression on each recipient. */
      kind: "match_recipient";
      /**
       * The regular expression; named groups can be used in actions as `\g<name>`.
       * @example "reply\\+(?P<token>.+)@reply.app.test"
       */
      pattern: string;
    }
  | {
      /** A regular expression on a header. */
      kind: "match_header";
      /**
       * The header to match, e.g. `subject`.
       * @example "subject"
       */
      header_name: string;
      /**
       * The regular expression for the header's value.
       * @example ".*support"
       */
      pattern: string;
    }
  | {
      /** Every incoming email. */
      kind: "catch_all";
    };

/** What a route does with a matching email, in order. */
export type InboundRouteAction =
  | {
      /** POSTs the parsed email to a URL in Mailgun's format. */
      kind: "forward_url";
      /**
       * Your app's inbound mail webhook.
       * @example "http://localhost:8000/webhooks/mail"
       */
      url: string;
    }
  | {
      /** Forwards to a real address, only through the release allowlist. */
      kind: "forward_email";
      /**
       * The real address.
       * @example "dev@yourcompany.com"
       */
      address: string;
    }
  | {
      /** Keeps the message and can POST a notification with its `message-url`. */
      kind: "store";
      /**
       * Where the notification goes; null stores without notifying.
       * @example "http://localhost:8000/webhooks/stored"
       */
      notify_url: string | null;
    }
  | {
      /** Skips the routes with a higher priority number. */
      kind: "stop";
    };

/** A Mailgun-style inbound route (WH-12.7). */
export type InboundRoute = {
  id: Ulid;
  /**
   * Lower runs first.
   * @example 10
   */
  priority: number;
  /**
   * A name for the route, shown in the list.
   * @example "Ticket replies to the helpdesk"
   */
  description: string;
  /**
   * Which incoming emails the route takes.
   */
  filter: InboundRouteFilter;
  /** The filter in Mailgun syntax, e.g. `match_recipient("support@.*")`. */
  expression: string;
  /**
   * What the route does with a matching email, in order.
   */
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
export type InboundRouteTestRequest = {
  /**
   * The filter to try on the 50 most recent incoming emails.
   */
  filter: InboundRouteFilter;
};

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

/** Body of POST /api/v1/inbound-routes/match: the email about to arrive (EM-22.2). */
export type InboundRouteMatchRequest = {
  /**
   * The recipients the incoming email would have.
   * @example ["support@inbound.app.test"]
   */
  to: string[];
  /**
   * Copied recipients; routes read them like `to`.
   * @example ["lee@example.test"]
   */
  cc?: string[];
  /**
   * Headers by name.
   * @example {"subject":"Re: Your receipt","from":"sam@example.test"}
   */
  headers?: Record<string, string>;
};

/** A route that would run, with its actions as they would run (named groups filled in). */
export type MatchedInboundRoute = {
  route_id: Ulid;
  /**
   * Lower runs first.
   * @example 10
   */
  priority: number;
  /**
   * The route's name.
   * @example "Ticket replies to the helpdesk"
   */
  description: string;
  /** The filter in Mailgun syntax, e.g. `match_recipient("support@.*")`. */
  expression: string;
  /** The recipient or header value that matched. */
  matched_value: string;
  /**
   * What the route would do, in order.
   */
  actions: InboundRouteAction[];
  /** Each action in Mailgun syntax, e.g. `forward("http://...")`. */
  action_expressions: string[];
  /** The route calls `stop()`, so no later route runs. */
  calls_stop: boolean;
};

/** Where an incoming email would go; nothing is stored or sent. */
export type InboundRouteMatchResult = {
  /**
   * The routes that would run, in run order, ending at one that calls `stop()`.
   */
  routes: MatchedInboundRoute[];
  /**
   * The webhook rules on `email.inbound` that would send, in rule order.
   */
  webhook_rules: MatchedWebhookRule[];
};
