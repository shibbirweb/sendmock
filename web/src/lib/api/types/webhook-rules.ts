import type { CreatedBy, IsoTimestamp, Ulid } from "@/lib/api/types/common";
import type { AppEventType } from "@/lib/api/types/events";

export type RuleFilterOperator =
  "equals" | "contains" | "starts_with" | "matches" | "regex" | "exists";

export type RuleCondition = {
  /**
   * The message field: for email `from`, `to`, `cc`, `subject`, `body`, `header:<name>`, `has_attachment`, `tag`; for SMS `from`, `to`, `body`, `status`, `api`; for opens `open_count`, `first_open`, `source`.
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
