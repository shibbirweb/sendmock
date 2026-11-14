import type {
  CapturedHttpRequest,
  EmailDetail,
  SmsMessage,
} from "@/lib/api/types";
import { headerFieldPrefix } from "@/lib/webhooks/rule-filter/rule-fields";

/**
 * What a filter is checked against: an email, an SMS, a captured HTTP request,
 * or field values given for a message not stored yet, which win over the
 * stored message they sit on (WH-13.1).
 */
export type RuleMessage =
  | { messageKind: "email"; email: EmailDetail }
  | { messageKind: "sms"; smsMessage: SmsMessage }
  | { messageKind: "http"; capturedRequest: CapturedHttpRequest }
  | {
      messageKind: "fields";
      fieldValues: Record<string, string[]>;
      storedMessage: RuleMessage | null;
    };

function stripHtmlTags(htmlBody: string): string {
  return htmlBody
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readEmailField(email: EmailDetail, fieldKey: string): string[] | null {
  if (fieldKey.startsWith(headerFieldPrefix)) {
    const headerName = fieldKey.slice(headerFieldPrefix.length).toLowerCase();
    const headerEntry = Object.entries(email.headers).find(
      ([existingName]) => existingName.toLowerCase() === headerName,
    );

    return headerEntry?.[1] ?? [];
  }

  const emailFieldReaders: Record<string, () => string[]> = {
    from: () => [email.from.address],
    to: () => email.to.map((recipient) => recipient.address),
    cc: () => email.cc.map((recipient) => recipient.address),
    subject: () => [email.subject],
    body: () => [email.text_body ?? stripHtmlTags(email.html_body ?? "")],
    has_attachment: () => [String(email.attachments.length > 0)],
    tag: () => email.tags,
    open_count: () => [String(email.open_count)],
    first_open: () => [String(email.open_count === 1)],
    project: () => [email.project],
  };

  return emailFieldReaders[fieldKey]?.() ?? null;
}

function readSmsField(
  smsMessage: SmsMessage,
  fieldKey: string,
): string[] | null {
  const smsFieldReaders: Record<string, () => string[]> = {
    from: () => [smsMessage.from_number],
    to: () => [smsMessage.to_number],
    body: () => [smsMessage.body],
    status: () => [smsMessage.status],
    api: () => [smsMessage.api],
    open_count: () => [String(smsMessage.open_count)],
    first_open: () => [String(smsMessage.open_count === 1)],
    project: () => [smsMessage.project],
  };

  return smsFieldReaders[fieldKey]?.() ?? null;
}

/** HTTP catcher response rules match on headers and the raw body (HC-02.1). */
function readHttpField(
  capturedRequest: CapturedHttpRequest,
  fieldKey: string,
): string[] | null {
  if (fieldKey.startsWith(headerFieldPrefix)) {
    const headerName = fieldKey.slice(headerFieldPrefix.length).toLowerCase();
    const headerEntry = Object.entries(capturedRequest.headers).find(
      ([existingName]) => existingName.toLowerCase() === headerName,
    );

    return headerEntry === undefined ? [] : [headerEntry[1]];
  }

  return fieldKey === "body" ? [capturedRequest.body] : null;
}

/** The field's values, or null when this kind of message has no such field. */
export function readMessageField(
  ruleMessage: RuleMessage,
  fieldKey: string,
): string[] | null {
  if (ruleMessage.messageKind === "email") {
    return readEmailField(ruleMessage.email, fieldKey);
  }
  if (ruleMessage.messageKind === "sms") {
    return readSmsField(ruleMessage.smsMessage, fieldKey);
  }
  if (ruleMessage.messageKind === "fields") {
    return readGivenField(ruleMessage, fieldKey);
  }

  return readHttpField(ruleMessage.capturedRequest, fieldKey);
}

/** A given value wins; header names compare without case, as on a message. */
function readGivenField(
  givenFields: Extract<RuleMessage, { messageKind: "fields" }>,
  fieldKey: string,
): string[] | null {
  const givenEntry = Object.entries(givenFields.fieldValues).find(
    ([givenKey]) =>
      givenKey === fieldKey ||
      (fieldKey.startsWith(headerFieldPrefix) &&
        givenKey.toLowerCase() === fieldKey.toLowerCase()),
  );
  if (givenEntry !== undefined) {
    return givenEntry[1];
  }

  return givenFields.storedMessage === null
    ? null
    : readMessageField(givenFields.storedMessage, fieldKey);
}
