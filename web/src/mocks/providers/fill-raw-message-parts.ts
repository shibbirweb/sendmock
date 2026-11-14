import type { ProviderMessagePart } from "@/lib/api/types";
import { decodeBase64 } from "@/mocks/fixtures/inline-files";

/** The headers of a MIME message by lowercase name, with folded lines joined. */
function readMessageHeaders(headerBlock: string): Map<string, string> {
  const messageHeaders = new Map<string, string>();
  const unfoldedBlock = headerBlock.replace(/\r?\n[ \t]+/g, " ");
  for (const headerLine of unfoldedBlock.split(/\r?\n/)) {
    const separatorIndex = headerLine.indexOf(":");
    if (separatorIndex > 0) {
      messageHeaders.set(
        headerLine.slice(0, separatorIndex).trim().toLowerCase(),
        headerLine.slice(separatorIndex + 1).trim(),
      );
    }
  }

  return messageHeaders;
}

/** `Shop <shop@x.test>, sam@x.test` to the bare addresses. */
function readAddressList(addressList: string | undefined): string[] {
  return (addressList ?? "")
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((address) => (address.match(/<([^>]+)>/)?.[1] ?? address).trim())
    .filter((address) => address !== "");
}

/**
 * A `raw` part carries a whole MIME message in base64 (SES v2's
 * `Content.Raw.Data`): the parts the request leaves out are read from its
 * headers and body, as the binary does (EM-08.1).
 */
export function fillPartsFromRawMessage(
  partValues: Map<ProviderMessagePart, string[]>,
): void {
  const rawBytes = decodeBase64(partValues.get("raw")?.[0] ?? "");
  if (rawBytes === null || rawBytes.length === 0) {
    return;
  }
  const rawMessage = new TextDecoder().decode(rawBytes);
  const [headerBlock = "", ...bodyParts] = rawMessage.split(/\r?\n\r?\n/);
  const messageHeaders = readMessageHeaders(headerBlock);
  const messageBody = bodyParts.join("\n\n");
  const contentType = messageHeaders.get("content-type") ?? "text/plain";
  const rawParts: [ProviderMessagePart, string[]][] = [
    ["from", readAddressList(messageHeaders.get("from"))],
    ["to", readAddressList(messageHeaders.get("to"))],
    ["cc", readAddressList(messageHeaders.get("cc"))],
    ["subject", [messageHeaders.get("subject") ?? ""]],
    ["text", contentType.startsWith("text/plain") ? [messageBody] : []],
    ["html", contentType.startsWith("text/html") ? [messageBody] : []],
  ];
  for (const [part, rawValues] of rawParts) {
    const presentValues = rawValues.filter((rawValue) => rawValue !== "");
    if (presentValues.length > 0 && (partValues.get(part) ?? []).length === 0) {
      partValues.set(part, presentValues);
    }
  }
}
