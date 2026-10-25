import type {
  EmailOutcomeKind,
  EmailOutcomeRule,
  SmsOutcomeKind,
  SmsOutcomeRule,
} from "@/lib/api/types";

export const smsOutcomeLabels: Record<SmsOutcomeKind, string> = {
  reject: "Reject on send",
  undelivered: "Accepted, then undelivered",
  failed: "Accepted, then failed",
  delayed_delivery: "Delivered after a delay",
  read: "Delivered, then read",
};

export const emailOutcomeLabels: Record<EmailOutcomeKind, string> = {
  delivered: "Delivered",
  hard_bounce: "Hard bounce",
  soft_bounce: "Soft bounce (deferred)",
  complaint: "Spam complaint",
  unsubscribe: "Unsubscribe",
  reject: "Reject the recipient",
};

/** "Undelivered, 30007" or "Delivered after 10 s", for the rule list. */
export function describeSmsRuleOutcome(
  outcomeRule: Pick<SmsOutcomeRule, "outcome" | "error_code" | "delay_seconds">,
): string {
  if (outcomeRule.outcome === "delayed_delivery") {
    return `Delivered after ${outcomeRule.delay_seconds ?? 0} s`;
  }
  if (outcomeRule.outcome === "read") {
    return smsOutcomeLabels.read;
  }

  return `${smsOutcomeLabels[outcomeRule.outcome]}, ${outcomeRule.error_code ?? ""}`;
}

export function describeEmailRuleOutcome(
  outcomeRule: Pick<EmailOutcomeRule, "outcome" | "smtp_code">,
): string {
  const outcomeLabel = emailOutcomeLabels[outcomeRule.outcome];

  return outcomeRule.smtp_code === null
    ? outcomeLabel
    : `${outcomeLabel}, ${outcomeRule.smtp_code}`;
}
