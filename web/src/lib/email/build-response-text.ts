import type { EmailAddress, EmailDetail } from "@/lib/api/types";

type OriginalEmailFields = Pick<
  EmailDetail,
  "from" | "to" | "subject" | "received_at" | "text_body" | "snippet"
>;

/** The characters RFC 5322 allows in a display name only inside a quoted string. */
const displayNameSpecials = /[()<>[\]:;@\\,."]/;

function quoteDisplayName(displayName: string): string {
  if (!displayNameSpecials.test(displayName)) {
    return displayName;
  }
  const escapedName = displayName.replace(
    /[\\"]/g,
    (special) => `\\${special}`,
  );
  return `"${escapedName}"`;
}

/**
 * `Name <address>`, with the name quoted when it needs it, so a comma in a name
 * does not split the header into two addresses.
 */
export function formatEmailAddress(emailAddress: EmailAddress): string {
  return emailAddress.name
    ? `${quoteDisplayName(emailAddress.name)} <${emailAddress.address}>`
    : emailAddress.address;
}

function readOriginalText(originalEmail: OriginalEmailFields): string {
  return originalEmail.text_body ?? originalEmail.snippet;
}

/** "On <date>, <sender> wrote:" followed by the original, each line quoted. */
export function quoteOriginalEmail(originalEmail: OriginalEmailFields): string {
  const quotedLines = readOriginalText(originalEmail)
    .split("\n")
    .map((originalLine) => `> ${originalLine}`);
  const sentAt = new Date(originalEmail.received_at).toUTCString();

  return [
    `On ${sentAt}, ${formatEmailAddress(originalEmail.from)} wrote:`,
    ...quotedLines,
  ].join("\n");
}

/** The block mail clients put above a forwarded message. */
export function buildForwardedMessageBlock(
  originalEmail: OriginalEmailFields,
): string {
  return [
    "---------- Forwarded message ---------",
    `From: ${formatEmailAddress(originalEmail.from)}`,
    `Date: ${new Date(originalEmail.received_at).toUTCString()}`,
    `Subject: ${originalEmail.subject}`,
    `To: ${originalEmail.to.map(formatEmailAddress).join(", ")}`,
    "",
    readOriginalText(originalEmail),
  ].join("\n");
}
