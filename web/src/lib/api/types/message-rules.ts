import type { Ulid } from "@/lib/api/types/common";
import type { RuleFilter } from "@/lib/api/types/webhooks";

/** Adds a tag to arriving emails that match its filter (EM-12.3). */
export type TagRule = {
  id: Ulid;
  name: string;
  /** The webhook rule filter, over email fields; null matches every email. */
  filter: RuleFilter | null;
  tag: string;
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
  name: string;
  filter: RuleFilter | null;
  /** Real addresses; each must be on the relay allowlist. */
  to: string[];
  is_enabled: boolean;
  position: number;
};

/** Body of POST and PATCH /api/v1/forward-rules. */
export type ForwardRuleInput = Pick<
  ForwardRule,
  "name" | "filter" | "to" | "is_enabled"
>;

/** Body of POST /api/v1/tag-rules/{ruleId}/move and /forward-rules/{ruleId}/move. */
export type MessageRuleMove = { direction: "up" | "down" };
