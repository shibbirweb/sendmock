import type { AppEvent, EmailDetail } from "@/lib/api/types";
import { evaluateRuleFilter } from "@/lib/webhooks/rule-filter/evaluate-rule-filter";
import { mockDatabase } from "@/mocks/db/mock-database";
import { matchesOutcomePattern } from "@/lib/outcomes/match-outcome-pattern";
import {
  publishMockEvent,
  subscribeToMockEvents,
} from "@/mocks/realtime/mock-event-bus";

function byPosition<Rule extends { position: number; is_enabled: boolean }>(
  rules: Rule[],
): Rule[] {
  return rules
    .filter((rule) => rule.is_enabled)
    .toSorted(
      (firstRule, secondRule) => firstRule.position - secondRule.position,
    );
}

/** Only allowlisted addresses are forwarded, and only with a relay set (EM-14.1). */
function isForwardAllowed(recipientAddress: string): boolean {
  const { relay_smtp_url, relay_recipient_allowlist } = mockDatabase.settings;

  return (
    relay_smtp_url !== null &&
    relay_recipient_allowlist.some((allowedPattern) =>
      matchesOutcomePattern(allowedPattern, recipientAddress),
    )
  );
}

function addTimelineEntry(email: EmailDetail, detail: string) {
  mockDatabase.emailTimelines.get(email.id)?.push({
    kind: "released",
    at: new Date().toISOString(),
    detail,
  });
}

/** Tag rules add their tag, then auto-forward rules release a copy (EM-12.3, EM-14.3). */
export function applyMessageRules(email: EmailDetail) {
  const ruleMessage = { messageKind: "email" as const, email };
  for (const tagRule of byPosition(mockDatabase.messageRules.tagRules)) {
    if (
      evaluateRuleFilter(tagRule.filter, ruleMessage) &&
      !email.tags.includes(tagRule.tag)
    ) {
      email.tags = [...email.tags, tagRule.tag];
    }
  }
  for (const forwardRule of byPosition(
    mockDatabase.messageRules.forwardRules,
  )) {
    if (!evaluateRuleFilter(forwardRule.filter, ruleMessage)) {
      continue;
    }
    const allowedRecipients = forwardRule.to.filter(isForwardAllowed);
    if (allowedRecipients.length === 0) {
      addTimelineEntry(
        email,
        `Not forwarded by rule ${forwardRule.name}: no relay, or no address on the allowlist`,
      );
      continue;
    }
    addTimelineEntry(
      email,
      `Forwarded by rule ${forwardRule.name} to ${allowedRecipients.join(", ")} (demo: nothing was sent)`,
    );
    publishMockEvent("email.released", { id: email.id });
  }
}

function applyRulesOnArrival(appEvent: AppEvent) {
  if (
    appEvent.type !== "email.received" ||
    typeof appEvent.data.id !== "string"
  ) {
    return;
  }
  const arrivedEmail = mockDatabase.emails.find(
    (email) => email.id === appEvent.data.id,
  );
  if (arrivedEmail !== undefined) {
    applyMessageRules(arrivedEmail);
  }
}

export function startMessageRules() {
  subscribeToMockEvents(applyRulesOnArrival);
}
