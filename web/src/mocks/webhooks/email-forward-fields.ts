import type { EmailDetail } from "@/lib/api/types";

/** RFC 3676's signature separator, on a line of its own. */
const signatureSeparator = "\n-- \n";

function readFirstHeader(
  headers: Record<string, string[]>,
  headerName: string,
): string {
  const matchingName = Object.keys(headers).find(
    (storedName) => storedName.toLowerCase() === headerName.toLowerCase(),
  );
  return matchingName === undefined ? "" : (headers[matchingName]?.[0] ?? "");
}

/** The text without its quoted reply and signature, and the signature, as Mailgun strips them. */
function splitReplyText(textBody: string): [string, string] {
  const separatorIndex = textBody.indexOf(signatureSeparator);
  const messageText =
    separatorIndex === -1 ? textBody : textBody.slice(0, separatorIndex);
  const signature =
    separatorIndex === -1
      ? ""
      : textBody.slice(separatorIndex + signatureSeparator.length).trim();
  const keptLines: string[] = [];
  for (const line of messageText.split("\n")) {
    if (line.trimStart().startsWith(">")) {
      break;
    }
    keptLines.push(line);
  }
  const lastLine = keptLines.at(-1) ?? "";
  if (
    lastLine.trimStart().startsWith("On ") &&
    lastLine.trimEnd().endsWith("wrote:")
  ) {
    keptLines.pop();
  }
  return [keptLines.join("\n").trim(), signature];
}

/**
 * The fields inbound formats such as Mailgun's forward read beyond the stored email, as the
 * binary's template data has them.
 */
export function buildEmailForwardFields(
  email: EmailDetail,
): Record<string, unknown> {
  const [strippedText, strippedSignature] = splitReplyText(
    email.text_body ?? "",
  );
  return {
    in_reply_to: readFirstHeader(email.headers, "In-Reply-To"),
    references: readFirstHeader(email.headers, "References"),
    header_pairs: Object.entries(email.headers).flatMap(
      ([headerName, headerValues]) =>
        headerValues.map((headerValue) => [headerName, headerValue]),
    ),
    stripped_text: strippedText,
    stripped_signature: strippedSignature,
    content_id_map: Object.fromEntries(
      email.attachments
        .map((attachment, attachmentIndex) => [
          attachment.content_id,
          `attachment-${attachmentIndex + 1}`,
        ])
        .filter(
          ([contentId]) => typeof contentId === "string" && contentId !== "",
        )
        .map(([contentId, fieldName]) => [
          `<${String(contentId).replace(/^<|>$/g, "")}>`,
          fieldName,
        ]),
    ),
    message_url: `http://127.0.0.1:8026/v3/domains/inbound/messages/${email.id}`,
    provider_message_id: email.provider_message_id,
    user_variables: email.user_variables,
  };
}
