import type { EmailAddress, EmailDetail } from "@/lib/api/types";

/** Which composer is open under the email header. */
export type EmailComposerMode = "reply" | "reply_all" | "forward";

export const composerHeadings: Record<EmailComposerMode, string> = {
  reply: "Reply as recipient",
  reply_all: "Reply all as recipient",
  forward: "Forward as recipient",
};

/** Only mail your app sent can be answered by its recipient (EM-17.5). */
export function canRespondToEmail(email: Pick<EmailDetail, "direction">) {
  return email.direction === "outbound";
}

/** Everyone the email was sent to, for the From suggestions and Reply all. */
export function listOriginalRecipients(
  email: Pick<EmailDetail, "to" | "cc">,
): EmailAddress[] {
  return [...email.to, ...email.cc];
}

export function hasSeveralRecipients(email: Pick<EmailDetail, "to" | "cc">) {
  return listOriginalRecipients(email).length > 1;
}

/** Where a reply goes: the original Reply-To, else its sender. */
export function readReplyRecipient(
  email: Pick<EmailDetail, "reply_to" | "from">,
): EmailAddress {
  return email.reply_to[0] ?? email.from;
}
