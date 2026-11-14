import type {
  RulePreviewItem,
  RulePreviewRequest,
  RulePreviewResult,
} from "@/lib/api/types";
import { evaluateRuleFilter } from "@/lib/webhooks/rule-filter/evaluate-rule-filter";
import type { RuleMessage } from "@/lib/webhooks/rule-filter/read-message-field";
import { readEventSubjects } from "@/lib/webhooks/rule-filter/rule-fields";
import type { MockDatabase } from "@/mocks/db/mock-database";

const previewMessageLimit = 50;

/** The rule preview lists emails and SMS only. */
type PreviewMessage = Extract<RuleMessage, { messageKind: "email" | "sms" }>;

function readMessageTime(ruleMessage: PreviewMessage): string {
  return ruleMessage.messageKind === "email"
    ? ruleMessage.email.received_at
    : ruleMessage.smsMessage.created_at;
}

function toPreviewItem(
  ruleMessage: PreviewMessage,
  isMatch: boolean,
): RulePreviewItem {
  if (ruleMessage.messageKind === "email") {
    const { email } = ruleMessage;

    return {
      message_kind: "email",
      message_id: email.id,
      title: email.subject === "" ? "(no subject)" : email.subject,
      detail: email.from.address,
      created_at: email.received_at,
      is_match: isMatch,
    };
  }

  const { smsMessage } = ruleMessage;

  return {
    message_kind: "sms",
    message_id: smsMessage.id,
    title: smsMessage.body,
    detail: `${smsMessage.from_number} to ${smsMessage.to_number}`,
    created_at: smsMessage.created_at,
    is_match: isMatch,
  };
}

/**
 * Which of the last 50 messages the selected events are about would pass
 * the filter (WH-02.3).
 */
export function previewRuleFilter(
  mockDatabase: MockDatabase,
  previewRequest: RulePreviewRequest,
): RulePreviewResult {
  const eventSubjects = readEventSubjects(previewRequest.events);
  const candidateMessages: PreviewMessage[] = [
    ...(eventSubjects.includes("email")
      ? mockDatabase.emails.map((email): PreviewMessage => ({
          messageKind: "email",
          email,
        }))
      : []),
    ...(eventSubjects.includes("sms")
      ? mockDatabase.smsMessages.map((smsMessage): PreviewMessage => ({
          messageKind: "sms",
          smsMessage,
        }))
      : []),
  ];
  const recentMessages = candidateMessages
    .sort((first, second) =>
      readMessageTime(second).localeCompare(readMessageTime(first)),
    )
    .slice(0, previewMessageLimit);
  const items = recentMessages.map((ruleMessage) =>
    toPreviewItem(
      ruleMessage,
      evaluateRuleFilter(previewRequest.filter, ruleMessage),
    ),
  );

  return {
    checked_count: items.length,
    match_count: items.filter((previewItem) => previewItem.is_match).length,
    items,
  };
}
