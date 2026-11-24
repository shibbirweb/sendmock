import type { EmailAddress, EmailDetail } from "@/lib/api/types";
import { formatEmailAddress } from "@/lib/email/build-response-text";
import { isEmailAddressText } from "@/lib/email/email-address-text";

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

/** The To and Cc a reply starts with, each one an editable address line. */
export function listDefaultReplyRecipients(
  email: Pick<EmailDetail, "reply_to" | "from" | "to" | "cc">,
  composerMode: EmailComposerMode,
): { toRecipients: string[]; ccRecipients: string[] } {
  const responder = listOriginalRecipients(email)[0];
  const ccRecipients =
    composerMode === "reply_all"
      ? listOriginalRecipients(email)
          .filter((recipient) => recipient.address !== responder?.address)
          .map(formatEmailAddress)
      : [];

  return {
    toRecipients: [formatEmailAddress(readReplyRecipient(email))],
    ccRecipients,
  };
}

/**
 * A reply needs at least one To and only real addresses in To and Cc; a
 * forward needs an address to go to (EM-22.1, EM-17.7).
 */
export function canSendResponse(
  composerMode: EmailComposerMode,
  recipients: {
    forwardToAddress: string;
    toRecipients: string[];
    ccRecipients: string[];
  },
): boolean {
  if (composerMode === "forward") {
    return recipients.forwardToAddress.includes("@");
  }

  return (
    recipients.toRecipients.length > 0 &&
    [...recipients.toRecipients, ...recipients.ccRecipients].every(
      isEmailAddressText,
    )
  );
}
