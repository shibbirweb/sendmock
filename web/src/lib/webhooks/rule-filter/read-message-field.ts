import type {
  CapturedHttpRequest,
  EmailDetail,
  SmsMessage,
} from "@/lib/api/types";
import { headerFieldPrefix } from "@/lib/webhooks/rule-filter/rule-fields";

/** What a filter is checked against: an email, an SMS or a captured HTTP request. */
export type RuleMessage =
  | { messageKind: "email"; email: EmailDetail }
  | { messageKind: "sms"; smsMessage: SmsMessage }
  | { messageKind: "http"; capturedRequest: CapturedHttpRequest };

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

  return readHttpField(ruleMessage.capturedRequest, fieldKey);
}
