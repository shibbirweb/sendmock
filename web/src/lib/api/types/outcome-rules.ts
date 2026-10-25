import type { CreatedBy, Ulid } from "@/lib/api/types/common";

/** What a custom outcome number does to a matching message. */
export type SmsOutcomeKind =
  "reject" | "undelivered" | "failed" | "delayed_delivery" | "read";

/** A custom outcome number (SM-07.7): first enabled match wins. */
export type SmsOutcomeRule = {
  id: Ulid;
  /** 1-based order; lower numbers are checked first. */
  position: number;
  match_field: "to" | "from";
  /** Exact E.164 number, or `*` for any digits, e.g. `+1555777*`. */
  pattern: string;
  outcome: SmsOutcomeKind;
  /** Required for `reject`, `undelivered` and `failed`. */
  error_code: string | null;
  /** Required for `delayed_delivery`. */
  delay_seconds: number | null;
  note: string;
  is_enabled: boolean;
  created_by: CreatedBy;
};

/** Body of POST and PATCH /api/v1/outcome-rules/sms. */
export type SmsOutcomeRuleInput = Omit<
  SmsOutcomeRule,
  "id" | "position" | "created_by"
>;

/** What a custom outcome address does to a matching email. */
export type EmailOutcomeKind =
  | "delivered"
  | "hard_bounce"
  | "soft_bounce"
  | "complaint"
  | "unsubscribe"
  | "reject";

/** A custom outcome address (EM-10.5): first enabled match wins. */
export type EmailOutcomeRule = {
  id: Ulid;
  position: number;
  /** Exact address, or `*` wildcards, e.g. `*@bounce.qa.test`. */
  pattern: string;
  outcome: EmailOutcomeKind;
  /** SMTP reply for bounces and rejects, e.g. `550 5.1.1`. */
  smtp_code: string | null;
  diagnostic: string | null;
  note: string;
  is_enabled: boolean;
  created_by: CreatedBy;
};

/** Body of POST and PATCH /api/v1/outcome-rules/email. */
export type EmailOutcomeRuleInput = Omit<
  EmailOutcomeRule,
  "id" | "position" | "created_by"
>;

/** Body of POST /api/v1/outcome-rules/{kind}/{ruleId}/move. */
export type OutcomeRuleMove = { direction: "up" | "down" };
