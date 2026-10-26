import type { CreatedBy, Ulid } from "@/lib/api/types/common";

/** What a custom outcome number does to a matching message. */
export type SmsOutcomeKind =
  "reject" | "undelivered" | "failed" | "delayed_delivery" | "read";

/** A custom outcome number (SM-07.7): first enabled match wins. */
export type SmsOutcomeRule = {
  id: Ulid;
  /** 1-based order; lower numbers are checked first. */
  position: number;
  /**
   * Match the pattern against the recipient (`to`) or the sender (`from`).
   * @example "to"
   */
  match_field: "to" | "from";
  /**
   * Exact E.164 number, or `*` for any digits, e.g. `+1555777*`.
   * @example "+1555777*"
   */
  pattern: string;
  /**
   * What happens to a matching message: `reject` (the send fails), `undelivered`, `failed`, `delayed_delivery` or `read`.
   * @example "undelivered"
   */
  outcome: SmsOutcomeKind;
  /**
   * Required for `reject`, `undelivered` and `failed`.
   * @example "30003"
   */
  error_code: string | null;
  /**
   * Required for `delayed_delivery`.
   * @example 30
   */
  delay_seconds: number | null;
  /**
   * Why the rule exists, shown in the list.
   * @example "Unreachable handset for the retry test"
   */
  note: string;
  /**
   * Off rules are kept but skipped.
   * @example true
   */
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
  /**
   * Exact address, or `*` wildcards, e.g. `*@bounce.qa.test`.
   * @example "*@bounce.qa.test"
   */
  pattern: string;
  /**
   * What happens to a matching email: `delivered`, `hard_bounce`, `soft_bounce`, `complaint`, `unsubscribe` or `reject` (refused during SMTP `RCPT` and the HTTP send).
   * @example "hard_bounce"
   */
  outcome: EmailOutcomeKind;
  /**
   * SMTP reply for bounces and rejects, e.g. `550 5.1.1`.
   * @example "550 5.1.1"
   */
  smtp_code: string | null;
  /**
   * The diagnostic text sent with the SMTP code.
   * @example "user unknown"
   */
  diagnostic: string | null;
  /**
   * Why the rule exists, shown in the list.
   * @example "Bounce every QA signup"
   */
  note: string;
  /**
   * Off rules are kept but skipped.
   * @example true
   */
  is_enabled: boolean;
  created_by: CreatedBy;
};

/** Body of POST and PATCH /api/v1/outcome-rules/email. */
export type EmailOutcomeRuleInput = Omit<
  EmailOutcomeRule,
  "id" | "position" | "created_by"
>;

/** Body of POST /api/v1/outcome-rules/{kind}/{ruleId}/move. */
export type OutcomeRuleMove = {
  /**
   * `up` moves the rule one place earlier in the order, `down` one place later.
   * @example "up"
   */
  direction: "up" | "down";
};

/** Body of POST /api/v1/outcome-rules/email/test. */
export type EmailOutcomeTestRequest = {
  /**
   * The address to test against the outcome rules and magic addresses.
   * @example "bounce@example.test"
   */
  address: string;
};

/** Body of POST /api/v1/outcome-rules/sms/test. */
export type SmsOutcomeTestRequest = {
  /**
   * The number to test against the outcome rules and Twilio's magic numbers.
   * @example "+15005550001"
   */
  number: string;
  /**
   * Whether the number is the message's recipient (`to`) or sender (`from`).
   * @example "to"
   */
  match_field: "to" | "from";
};

/** Which source decides an outcome: a custom rule, a magic address or number, or the profile. */
export type OutcomeTestResult = {
  source: "custom" | "magic" | "profile";
  rule_id: string | null;
  /** One-based position of the matching custom rule. */
  rule_position: number | null;
  /** What the testers show, e.g. "Custom rule 2: Hard bounce, 550 5.1.1". */
  summary: string;
};
