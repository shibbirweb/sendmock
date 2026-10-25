import type { AppEvent } from "@/lib/api/types";
import { evaluateRuleFilter } from "@/lib/webhooks/rule-filter/evaluate-rule-filter";
import type { RuleMessage } from "@/lib/webhooks/rule-filter/read-message-field";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  publishMockEvent,
  subscribeToMockEvents,
} from "@/mocks/realtime/mock-event-bus";
import { buildAutoDelivery } from "@/mocks/webhooks/build-auto-delivery";

/** The email or SMS an event is about, looked up by the event's `id`. */
function findEventMessage(appEvent: AppEvent): RuleMessage | null {
  const subjectId = appEvent.data.id;
  if (typeof subjectId !== "string") {
    return null;
  }
  if (appEvent.type.startsWith("email.")) {
    const email = mockDatabase.emails.find(
      (existingEmail) => existingEmail.id === subjectId,
    );

    return email === undefined ? null : { messageKind: "email", email };
  }
  if (appEvent.type.startsWith("sms.")) {
    const smsMessage = mockDatabase.smsMessages.find(
      (existingMessage) => existingMessage.id === subjectId,
    );

    return smsMessage === undefined ? null : { messageKind: "sms", smsMessage };
  }

  return null;
}

/**
 * Creates a delivery for every enabled rule that matches an event, in rule
 * order, as the backend's delivery engine does. Webhook events are skipped
 * so a rule on `webhook.delivered` cannot loop in the mock.
 */
export function fireMatchingRules(appEvent: AppEvent) {
  if (appEvent.type.startsWith("webhook.") || appEvent.type === "test.ping") {
    return;
  }

  const eventMessage = findEventMessage(appEvent);
  const subjectId =
    typeof appEvent.data.id === "string" ? appEvent.data.id : null;
  const matchingRules = [...mockDatabase.webhookRules]
    .sort((firstRule, secondRule) => firstRule.order - secondRule.order)
    .filter(
      (webhookRule) =>
        webhookRule.is_enabled &&
        webhookRule.events.includes(appEvent.type) &&
        (webhookRule.filter === null ||
          (eventMessage !== null &&
            evaluateRuleFilter(webhookRule.filter, eventMessage))),
    );

  for (const webhookRule of matchingRules) {
    const endpointRecord = mockDatabase.webhookEndpoints.find(
      (existingEndpoint) => existingEndpoint.id === webhookRule.endpoint_id,
    );
    if (endpointRecord === undefined || !endpointRecord.is_enabled) {
      continue;
    }

    const autoDelivery = buildAutoDelivery({
      appEvent,
      webhookRule,
      endpointRecord,
      subjectId,
    });
    mockDatabase.webhookDeliveries.unshift(autoDelivery);
    publishMockEvent("webhook.delivered", {
      id: autoDelivery.id,
      endpoint_name: autoDelivery.endpoint_name,
    });
  }
}

/** Starts firing rules for every event the mock publishes. */
export function startRuleFiring() {
  subscribeToMockEvents(fireMatchingRules);
}
