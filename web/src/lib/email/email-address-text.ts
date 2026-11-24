import type { EmailAddress } from "@/lib/api/types";

/** `"Name, Jr" <address>` or `Name <address>`; the quoted name may hold `\"`. */
const namedAddressPattern =
  /^\s*(?:"((?:[^"\\]|\\.)*)"|([^<]*?))\s*<([^>]*)>\s*$/;

/** An address with something before and after one `@`, and no spaces. */
const bareAddressPattern = /^[^\s@]+@[^\s@]+$/;

/** The separators between addresses in a typed or pasted list. */
const listSeparators = new Set([",", ";", "\n"]);

/** `Name <address>`, `"Name, Jr" <address>` or a bare address, as its parts. */
export function parseEmailAddress(addressText: string): EmailAddress {
  const namedMatch = namedAddressPattern.exec(addressText);
  if (namedMatch === null) {
    return { name: "", address: addressText.trim() };
  }
  const quotedName = namedMatch[1];
  const displayName =
    quotedName === undefined
      ? (namedMatch[2] ?? "").trim()
      : quotedName.replace(/\\(.)/g, "$1");

  return { name: displayName, address: (namedMatch[3] ?? "").trim() };
}

/** Whether the text names one address that has a mailbox and a domain. */
export function isEmailAddressText(addressText: string): boolean {
  return bareAddressPattern.test(parseEmailAddress(addressText).address);
}

/**
 * The addresses in a typed or pasted list, split on commas, semicolons and
 * new lines outside quoted names and angle brackets.
 */
export function splitAddressList(addressListText: string): string[] {
  const addressTexts: string[] = [];
  let currentText = "";
  let isInQuotes = false;
  let isInBrackets = false;
  let isEscaped = false;

  for (const character of addressListText) {
    if (isEscaped) {
      isEscaped = false;
    } else if (isInQuotes && character === "\\") {
      isEscaped = true;
    } else if (character === '"') {
      isInQuotes = !isInQuotes;
    } else if (!isInQuotes && character === "<") {
      isInBrackets = true;
    } else if (!isInQuotes && character === ">") {
      isInBrackets = false;
    } else if (!isInQuotes && !isInBrackets && listSeparators.has(character)) {
      addressTexts.push(currentText);
      currentText = "";
      continue;
    }
    currentText += character;
  }
  addressTexts.push(currentText);

  return addressTexts
    .map((addressText) => addressText.trim())
    .filter((addressText) => addressText !== "");
}
