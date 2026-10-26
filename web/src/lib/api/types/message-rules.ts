import type { Ulid } from "@/lib/api/types/common";
import type { RuleFilter } from "@/lib/api/types/webhooks";

/** Adds a tag to arriving emails that match its filter (EM-12.3). */
export type TagRule = {
  id: Ulid;
  /**
   * A name for the rule, shown in the list.
   * @example "Tag password resets"
   */
  name: string;
  /**
   * The webhook rule filter, over email fields; null matches every email.
   */
  filter: RuleFilter | null;
  /**
   * The tag added to each matching email.
   * @example "password-reset"
   */
  tag: string;
  /**
   * Off rules are kept but skipped.
   * @example true
   */
  is_enabled: boolean;
  /** One-based; rules run in this order. */
  position: number;
};

/** Body of POST and PATCH /api/v1/tag-rules. */
export type TagRuleInput = Pick<
  TagRule,
  "name" | "filter" | "tag" | "is_enabled"
>;

/** Releases arriving emails that match its filter to real addresses (EM-14.3). */
export type ForwardRule = {
  id: Ulid;
  /**
   * A name for the rule, shown in the list.
   * @example "Invoices to finance QA"
   */
  name: string;
  /**
   * The webhook rule filter, over email fields; null matches every email.
   */
  filter: RuleFilter | null;
  /**
   * Real addresses; each must be on the relay allowlist.
   * @example ["finance-qa@yourcompany.com"]
   */
  to: string[];
  /**
   * Off rules are kept but skipped.
   * @example true
   */
  is_enabled: boolean;
  position: number;
};

/** Body of POST and PATCH /api/v1/forward-rules. */
export type ForwardRuleInput = Pick<
  ForwardRule,
  "name" | "filter" | "to" | "is_enabled"
>;

/** Body of POST /api/v1/tag-rules/{ruleId}/move and /forward-rules/{ruleId}/move. */
export type MessageRuleMove = {
  /**
   * `up` moves the rule one place earlier in the order, `down` one place later.
   * @example "up"
   */
  direction: "up" | "down";
};
