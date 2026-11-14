import type { EmailListFilters, EmailSource } from "@/lib/api/types";

const emailTransportSources: EmailSource[] = [
  "smtp",
  "sendmail",
  "native_api",
  "verify",
  "simulated",
];
/** The shipped providers, until the providers list has loaded. */
const builtinEmailProviderKeys = [
  "sendgrid",
  "mailgun",
  "postmark",
  "resend",
  "ses",
  "brevo",
];

export type MailSearchChip = {
  label: string;
  token: string;
};

/**
 * Turns a search box value such as `from:acme is:unread invoice` into list
 * filters (EM-03.4). Unknown `key:value` tokens stay in the free-text query.
 */
export function parseMailSearch(
  searchText: string,
  emailProviderKeys: string[] = builtinEmailProviderKeys,
): EmailListFilters {
  const knownEmailSources = [...emailTransportSources, ...emailProviderKeys];
  const emailFilters: EmailListFilters = {};
  const freeTextWords: string[] = [];

  for (const searchToken of searchText.trim().split(/\s+/).filter(Boolean)) {
    const [tokenKey = "", ...valueParts] = searchToken.split(":");
    const tokenValue = valueParts.join(":");
    const normalizedKey = tokenKey.toLowerCase();

    if (tokenValue === "") {
      freeTextWords.push(searchToken);
    } else if (normalizedKey === "from") {
      emailFilters.from = tokenValue;
    } else if (normalizedKey === "to") {
      emailFilters.to = tokenValue;
    } else if (normalizedKey === "tag") {
      emailFilters.tag = tokenValue;
    } else if (normalizedKey === "is" && tokenValue === "unread") {
      emailFilters.is_unread = true;
    } else if (
      normalizedKey === "is" &&
      (tokenValue === "inbound" || tokenValue === "outbound")
    ) {
      emailFilters.direction = tokenValue;
    } else if (normalizedKey === "has" && tokenValue === "attachment") {
      emailFilters.has_attachment = true;
    } else if (
      normalizedKey === "source" &&
      knownEmailSources.includes(tokenValue)
    ) {
      emailFilters.source = tokenValue;
    } else {
      freeTextWords.push(searchToken);
    }
  }

  if (freeTextWords.length > 0) {
    emailFilters.query = freeTextWords.join(" ");
  }

  return emailFilters;
}

/** Quick filters offered below the search box. */
export const mailSearchChips: MailSearchChip[] = [
  { label: "Unread", token: "is:unread" },
  { label: "Attachments", token: "has:attachment" },
  { label: "Inbound", token: "is:inbound" },
  { label: "SendGrid", token: "source:sendgrid" },
  { label: "SMTP", token: "source:smtp" },
];

/** Adds the token when missing, removes it when present. */
export function toggleSearchToken(
  searchText: string,
  searchToken: string,
): string {
  const searchTokens = searchText.trim().split(/\s+/).filter(Boolean);
  const hasToken = searchTokens.includes(searchToken);

  return (
    hasToken
      ? searchTokens.filter((existingToken) => existingToken !== searchToken)
      : [...searchTokens, searchToken]
  ).join(" ");
}
