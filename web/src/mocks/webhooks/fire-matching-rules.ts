import type { AppEvent, AppEventType } from "@/lib/api/types";
import { evaluateRuleFilter } from "@/lib/webhooks/rule-filter/evaluate-rule-filter";
import type { RuleMessage } from "@/lib/webhooks/rule-filter/read-message-field";
import { mockDatabase } from "@/mocks/db/mock-database";
import {
  publishMockEvent,
  subscribeToMockEvents,
} from "@/mocks/realtime/mock-event-bus";
import { buildAutoDelivery } from "@/mocks/webhooks/build-auto-delivery";
import type { WebhookEndpointRecord } from "@/mocks/webhooks/webhook-endpoint-record";

/**
 * Webhook events and the connection ping never reach rules or a chosen
 * endpoint, so a rule on `webhook.delivered` cannot loop in the mock.
 */
export function isRuledEvent(eventType: string): boolean {
  return !eventType.startsWith("webhook.") && eventType !== "test.ping";
}

/** The email or SMS an event is about, by its id. */
export function findSubjectMessage(
  eventType: string,
  subjectId: string | undefined,
): RuleMessage | null {
  if (subjectId === undefined) {
    return null;
  }
  if (eventType.startsWith("email.")) {
    const email = mockDatabase.emails.find(
      (existingEmail) => existingEmail.id === subjectId,
    );

    return email === undefined ? null : { messageKind: "email", email };
  }
  if (eventType.startsWith("sms.")) {
    const smsMessage = mockDatabase.smsMessages.find(
      (existingMessage) => existingMessage.id === subjectId,
    );

    return smsMessage === undefined ? null : { messageKind: "sms", smsMessage };
  }

  return null;
}

/**
 * Each enabled rule on the event whose filter passes the message, with its
 * enabled endpoint, in rule order. Firing and the match previews both read
 * this (EM-22.2, WH-13.1).
 */
export function findFiringRules(
  eventType: AppEventType,
  eventMessage: RuleMessage | null,
) {
  return [...mockDatabase.webhookRules]
    .sort((firstRule, secondRule) => firstRule.order - secondRule.order)
    .filter(
      (webhookRule) =>
        webhookRule.is_enabled &&
        webhookRule.events.includes(eventType) &&
        (webhookRule.filter === null ||
          (eventMessage !== null &&
            evaluateRuleFilter(webhookRule.filter, eventMessage))),
    )
    .flatMap((webhookRule) => {
      const endpointRecord = mockDatabase.webhookEndpoints.find(
        (existingEndpoint) => existingEndpoint.id === webhookRule.endpoint_id,
      );

      return endpointRecord === undefined || !endpointRecord.is_enabled
        ? []
        : [{ webhookRule, endpointRecord }];
    });
}

/** Where an event goes: the endpoints its action chose, or the rule matches. */
function listEventTargets(
  appEvent: AppEvent,
  subjectId: string | undefined,
  webhookChoice: string[] | null,
): { ruleId: string | null; endpointRecord: WebhookEndpointRecord }[] {
  if (webhookChoice !== null) {
    return webhookChoice.flatMap((endpointId) => {
      const endpointRecord = mockDatabase.webhookEndpoints.find(
        (existingEndpoint) => existingEndpoint.id === endpointId,
      );

      return endpointRecord === undefined || !endpointRecord.is_enabled
        ? []
        : [{ ruleId: null, endpointRecord }];
    });
  }

  return findFiringRules(
    appEvent.type,
    findSubjectMessage(appEvent.type, subjectId),
  ).map(({ webhookRule, endpointRecord }) => ({
    ruleId: webhookRule.id,
    endpointRecord,
  }));
}

/**
 * Creates a delivery for every enabled rule that matches an event, in rule
 * order, as the backend's delivery engine does; or, when the action chose
 * endpoints, one for each of those instead (WH-13.4).
 */
export function fireMatchingRules(
  appEvent: AppEvent,
  webhookChoice: string[] | null = null,
) {
  if (!isRuledEvent(appEvent.type)) {
    return;
  }

  const subjectId =
    typeof appEvent.data.id === "string" ? appEvent.data.id : undefined;
  for (const { ruleId, endpointRecord } of listEventTargets(
    appEvent,
    subjectId,
    webhookChoice,
  )) {
    const autoDelivery = buildAutoDelivery({
      appEvent,
      ruleId,
      endpointRecord,
      subjectId: subjectId ?? null,
      trigger: webhookChoice === null ? "auto" : "chosen",
    });
    mockDatabase.webhookDeliveries.unshift(autoDelivery);
    publishMockEvent("webhook.delivered", {
      id: autoDelivery.id,
      endpoint_name: autoDelivery.endpoint_name,
    });
    if (autoDelivery.status === "failed") {
      publishMockEvent("webhook.failed", {
        id: autoDelivery.id,
        endpoint_name: autoDelivery.endpoint_name,
        event_type: autoDelivery.event_type,
      });
    }
  }
}

/** Starts firing rules for every event the mock publishes. */
export function startRuleFiring() {
  subscribeToMockEvents(fireMatchingRules);
}
