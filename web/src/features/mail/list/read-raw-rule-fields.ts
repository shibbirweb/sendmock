import { readBareAddress } from "@/features/mail/detail/response/incoming-email-preview";

function splitAddresses(headerValue: string): string[] {
  return headerValue
    .split(",")
    .map(readBareAddress)
    .filter((address) => address !== "");
}

/**
 * From, To, Cc and Subject of a pasted or uploaded message, as rule filters
 * read them once it is stored (WH-13.1); folded header lines are joined.
 */
export function readRawRuleFields(
  rawMessage: string,
): Record<string, string[]> {
  const headerBlock = rawMessage.split(/\r?\n\r?\n/)[0] ?? "";
  const headerValues = new Map<string, string>();
  for (const headerLine of headerBlock
    .replace(/\r?\n[ \t]+/g, " ")
    .split(/\r?\n/)) {
    const separatorIndex = headerLine.indexOf(":");
    if (separatorIndex > 0) {
      headerValues.set(
        headerLine.slice(0, separatorIndex).trim().toLowerCase(),
        headerLine.slice(separatorIndex + 1).trim(),
      );
    }
  }

  return {
    from: splitAddresses(headerValues.get("from") ?? ""),
    to: splitAddresses(headerValues.get("to") ?? ""),
    cc: splitAddresses(headerValues.get("cc") ?? ""),
    subject: [headerValues.get("subject") ?? ""],
  };
}
