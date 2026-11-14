import type { WebhookRule } from "@/lib/api/types";

/**
 * True when an enabled webhook rule also receives `sms.inbound`, so a
 * number's own inbound URL would not be the only receiver.
 */
export function hasEnabledInboundSmsRule(
  webhookRules: Pick<WebhookRule, "is_enabled" | "events">[],
): boolean {
  return webhookRules.some(
    (webhookRule) =>
      webhookRule.is_enabled && webhookRule.events.includes("sms.inbound"),
  );
}
