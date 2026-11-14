import type { CreatedBy, IsoTimestamp, Ulid } from "@/lib/api/types/common";
import type { AppEventType } from "@/lib/api/types/events";
import type {
  HttpMethod,
  RenderProblem,
} from "@/lib/api/types/webhook-endpoints";

export type RuleFilterOperator =
  "equals" | "contains" | "starts_with" | "matches" | "regex" | "exists";

export type RuleCondition = {
  /**
   * The message field: for email `from`, `to`, `cc`, `subject`, `body`, `header:<name>`, `has_attachment`, `tag`; for SMS `from`, `to`, `body`, `status`, `api`; for push `token`, `title`, `body`, `provider`, `status`; for opens `open_count`, `first_open`, `source`.
   * @example "subject"
   */
  field: string;
  /**
   * `equals`, `contains`, `starts_with` and `matches` (glob) ignore case; `regex` is case-sensitive; `exists` is true when the field has a value.
   * @example "contains"
   */
  operator: RuleFilterOperator;
  /**
   * The value to compare with; ignored by `exists`.
   * @example "Ticket"
   */
  value: string;
};

export type RuleFilter =
  | {
      /** Matches when every filter in the list matches. */
      all: RuleFilter[];
    }
  | {
      /** Matches when at least one filter in the list matches. */
      any: RuleFilter[];
    }
  | {
      /** Matches when the filter inside does not. */
      not: RuleFilter;
    }
  | RuleCondition;

export type WebhookRule = {
  id: Ulid;
  /**
   * A name for the rule, shown in the list.
   * @example "Bounces to Slack"
   */
  name: string;
  /**
   * The endpoint each matching event is delivered to.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  endpoint_id: Ulid;
  /**
   * The event types the rule listens to.
   * @example ["email.bounced", "email.complained"]
   */
  events: AppEventType[];
  /**
   * Which messages match, combining conditions with `all`, `any` and `not`; null matches every event.
   */
  filter: RuleFilter | null;
  /**
   * Off rules are kept but skipped.
   * @example true
   */
  is_enabled: boolean;
  order: number;
  created_by: CreatedBy;
};

/** Body of POST and PATCH /api/v1/webhooks/rules. */
export type WebhookRuleInput = Pick<
  WebhookRule,
  "name" | "endpoint_id" | "events" | "filter" | "is_enabled"
>;

/** Body of POST /api/v1/webhooks/rules/{ruleId}/move. */
export type WebhookRuleMove = {
  /**
   * `up` moves the rule one place earlier in the order, `down` one place later.
   * @example "up"
   */
  direction: "up" | "down";
};

/** Body of POST /api/v1/webhooks/rules/preview (WH-02.3). */
export type RulePreviewRequest = {
  /**
   * The event types to test, as in the rule.
   * @example ["email.received"]
   */
  events: AppEventType[];
  /**
   * The filter to test against recent messages; null matches all.
   */
  filter: RuleFilter | null;
};

export type RulePreviewItem = {
  message_kind: "email" | "sms";
  message_id: Ulid;
  /** Subject, or the SMS body. */
  title: string;
  /** Sender address, or "+1555... to +1415...". */
  detail: string;
  created_at: IsoTimestamp;
  is_match: boolean;
};

export type RulePreviewResult = {
  checked_count: number;
  match_count: number;
  /** Newest first. */
  items: RulePreviewItem[];
};

/** An enabled webhook rule on the event whose filter passes, with its endpoint (WH-13.1). */
export type MatchedWebhookRule = {
  rule_id: Ulid;
  /**
   * The rule's name.
   * @example "Replies to my app"
   */
  rule_name: string;
  endpoint_id: Ulid;
  /**
   * The endpoint's name.
   * @example "Local app"
   */
  endpoint_name: string;
  /**
   * Where the rule sends.
   * @example "http://localhost:8000/webhooks/sendmock"
   */
  endpoint_url: string;
};

/** Body of POST /api/v1/webhooks/rules/match: the event an action is about to fire (WH-13.1). */
export type WebhookRuleMatchRequest = {
  /**
   * The event the action fires.
   * @example "email.bounced"
   */
  event_type: AppEventType;
  /**
   * The email, SMS, payment or push notification the event is about; its stored fields are what the rule filters read.
   * @example "01JB7T9Q2R5W8X3Y6Z1A4B7C9D"
   */
  subject_id?: Ulid;
  /**
   * Filter fields by name, for a message not stored yet or the values the event changes; they win over the stored message's.
   * @example {"to":["support@app.test"],"header:x-tenant":["acme"]}
   */
  data?: Record<string, string[]>;
  /**
   * Also render the request each matching endpoint would send for the event, with secrets masked (WH-14.1).
   * @example true
   */
  include_requests?: boolean;
  /**
   * With `include_requests`, render these endpoints' requests too, as chosen for the action instead of the rules (IDs from `GET /api/v1/webhooks/endpoints`).
   * @example ["01JB7T9Q2RENDPOINT00000000"]
   */
  webhook_endpoint_ids?: Ulid[];
};

/** The request one endpoint would send for the event, rendered with its template as a delivery would be (WH-14.1). */
export type MatchedWebhookRequest = {
  endpoint_id: Ulid;
  /**
   * The endpoint's name.
   * @example "Local app"
   */
  endpoint_name: string;
  /**
   * The event the request is for.
   * @example "email.bounced"
   */
  event_type: AppEventType;
  /**
   * @example "POST"
   */
  method: HttpMethod;
  /**
   * @example "http://localhost:8000/webhooks/sendmock"
   */
  url: string;
  /** Secret values are masked. */
  headers: Record<string, string>;
  /**
   * Values made at send time (ids, timestamps, `fake.*`) are made again when it is sent unless the body is edited.
   * @example "{\"type\":\"email.bounced\"}"
   */
  body: string;
  /** Errors stop a delivery as `render_failed`; warnings render empty. */
  problems: RenderProblem[];
};

/** The webhooks an event would trigger; nothing is stored or sent. */
export type WebhookRuleMatchResult = {
  /**
   * The rules that would send, in rule order.
   */
  webhook_rules: MatchedWebhookRule[];
  /**
   * With `include_requests`: the request each matching or chosen endpoint would send.
   */
  webhook_requests?: MatchedWebhookRequest[];
};
