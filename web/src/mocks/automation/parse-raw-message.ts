export type RawMessageParts = {
  from: string;
  to: string[];
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
};

/** Header names in lower case to their unfolded values. */
function readHeaders(headerBlock: string): Map<string, string> {
  const headers = new Map<string, string>();
  const unfoldedBlock = headerBlock.replaceAll(/\r?\n[ \t]+/g, " ");
  for (const headerLine of unfoldedBlock.split(/\r?\n/)) {
    const separatorIndex = headerLine.indexOf(":");
    if (separatorIndex > 0) {
      headers.set(
        headerLine.slice(0, separatorIndex).trim().toLowerCase(),
        headerLine.slice(separatorIndex + 1).trim(),
      );
    }
  }

  return headers;
}

function splitMessage(messageText: string): [string, string] {
  const separator = /\r?\n\r?\n/.exec(messageText);
  if (separator === null) {
    return [messageText, ""];
  }

  return [
    messageText.slice(0, separator.index),
    messageText.slice(separator.index + separator[0].length),
  ];
}

/** The text and HTML bodies of a single part or a multipart message. */
function readBodies(contentType: string, bodyText: string) {
  const boundary = /boundary="?([^";]+)"?/i.exec(contentType)?.[1];
  if (boundary === undefined) {
    const isHtml = /text\/html/i.test(contentType);
    return {
      textBody: isHtml ? null : bodyText.trim(),
      htmlBody: isHtml ? bodyText.trim() : null,
    };
  }
  let textBody: string | null = null;
  let htmlBody: string | null = null;
  for (const partText of bodyText.split(`--${boundary}`)) {
    const [partHeaderBlock, partBody] = splitMessage(
      partText.replace(/^\r?\n/, ""),
    );
    const partType = readHeaders(partHeaderBlock).get("content-type") ?? "";
    if (/text\/plain/i.test(partType) && textBody === null) {
      textBody = partBody.trim();
    } else if (/text\/html/i.test(partType) && htmlBody === null) {
      htmlBody = partBody.trim();
    }
  }

  return { textBody, htmlBody };
}

/**
 * Reads the parts the mock stores from a raw message (RFC 5322): enough for
 * `POST /send/raw` and `POST /emails/inbound`; the real server parses fully.
 */
export function parseRawMessage(messageText: string): RawMessageParts {
  const [headerBlock, bodyText] = splitMessage(messageText);
  const headers = readHeaders(headerBlock);
  const recipients = [headers.get("to"), headers.get("cc")]
    .filter((headerValue): headerValue is string => headerValue !== undefined)
    .flatMap((headerValue) => headerValue.split(","))
    .map((recipient) => recipient.trim())
    .filter((recipient) => recipient !== "");

  return {
    from: headers.get("from") ?? "",
    to: recipients,
    subject: headers.get("subject") ?? "(no subject)",
    ...readBodies(headers.get("content-type") ?? "text/plain", bodyText),
  };
}
