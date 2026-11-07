import type { EmailListFilters, EmailSummary } from "@/lib/api/types";

/** `*@my-feature.test` matches like the list's contains search: the stars are dropped. */
function includesIgnoringCase(text: string, wantedText: string): boolean {
  return text
    .toLowerCase()
    .includes(wantedText.replaceAll("*", "").toLowerCase());
}

/**
 * Whether a new email fits the Mail list's current search, so notifications follow
 * the filter in the list header (EM-16.1). No filter lets every email through.
 */
export function matchesNotificationFilter(
  emailSummary: Partial<EmailSummary>,
  emailFilters: EmailListFilters,
): boolean {
  const fromAddress = emailSummary.from?.address ?? "";
  const toAddresses = (emailSummary.to ?? []).map(
    (recipient) => recipient.address,
  );
  const searchableText = [
    emailSummary.subject ?? "",
    fromAddress,
    ...toAddresses,
  ].join(" ");

  if (
    emailFilters.from !== undefined &&
    !includesIgnoringCase(fromAddress, emailFilters.from)
  ) {
    return false;
  }
  if (
    emailFilters.to !== undefined &&
    !toAddresses.some((toAddress) =>
      includesIgnoringCase(toAddress, emailFilters.to ?? ""),
    )
  ) {
    return false;
  }
  if (
    emailFilters.tag !== undefined &&
    !(emailSummary.tags ?? []).includes(emailFilters.tag)
  ) {
    return false;
  }
  if (
    emailFilters.has_attachment === true &&
    (emailSummary.attachment_count ?? 0) === 0
  ) {
    return false;
  }

  return (emailFilters.query ?? "")
    .split(/\s+/)
    .filter((searchWord) => searchWord !== "")
    .every((searchWord) => includesIgnoringCase(searchableText, searchWord));
}
