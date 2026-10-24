import type { EmailDetail, MimePart } from "@/lib/api/types";

/**
 * Builds the raw RFC 5322 source and the matching MIME tree for a fixture
 * email, so the Source and MIME tabs show consistent, realistic data.
 */

function formatAddress(emailAddress: { name: string; address: string }) {
  return emailAddress.name
    ? `"${emailAddress.name}" <${emailAddress.address}>`
    : emailAddress.address;
}

function encodeBase64Text(text: string): string {
  const utf8Bytes = new TextEncoder().encode(text);
  let binaryText = "";
  for (const byte of utf8Bytes) {
    binaryText += String.fromCharCode(byte);
  }

  return (btoa(binaryText).match(/.{1,76}/g) ?? []).join("\r\n");
}

function hasAlternativeBodies(email: EmailDetail): boolean {
  return email.text_body !== null && email.html_body !== null;
}

export function buildEmailMimeTree(email: EmailDetail): MimePart {
  const bodyParts: MimePart[] = [];

  if (email.text_body !== null) {
    bodyParts.push({
      part_id: "1.1",
      content_type: "text/plain",
      transfer_encoding: "quoted-printable",
      charset: "utf-8",
      size_bytes: email.text_body.length,
      filename: null,
      content_id: null,
      children: [],
    });
  }
  if (email.html_body !== null) {
    bodyParts.push({
      part_id: "1.2",
      content_type: "text/html",
      transfer_encoding: "quoted-printable",
      charset: "utf-8",
      size_bytes: email.html_body.length,
      filename: null,
      content_id: null,
      children: [],
    });
  }

  const alternativePart: MimePart = {
    part_id: "1",
    content_type: hasAlternativeBodies(email)
      ? "multipart/alternative"
      : (bodyParts[0]?.content_type ?? "text/plain"),
    transfer_encoding: null,
    charset: null,
    size_bytes: bodyParts.reduce((total, part) => total + part.size_bytes, 0),
    filename: null,
    content_id: null,
    children: hasAlternativeBodies(email) ? bodyParts : [],
  };

  const attachmentParts: MimePart[] = email.attachments.map(
    (attachment, attachmentIndex) => ({
      part_id: String(attachmentIndex + 2),
      content_type: attachment.content_type,
      transfer_encoding: "base64",
      charset: null,
      size_bytes: attachment.size_bytes,
      filename: attachment.filename,
      content_id: attachment.content_id,
      children: [],
    }),
  );

  return {
    part_id: "0",
    content_type:
      attachmentParts.length > 0
        ? "multipart/mixed"
        : alternativePart.content_type,
    transfer_encoding: null,
    charset: null,
    size_bytes: email.size_bytes,
    filename: null,
    content_id: null,
    children:
      attachmentParts.length > 0
        ? [alternativePart, ...attachmentParts]
        : alternativePart.children,
  };
}

export function buildRawEmailSource(email: EmailDetail): string {
  const mixedBoundary = `mixed_${email.id}`;
  const alternativeBoundary = `alt_${email.id}`;
  const headerLines = [
    `Return-Path: <${email.envelope_from}>`,
    `Message-ID: ${email.message_id ?? `<${email.id}@sendmock.local>`}`,
    `Date: ${new Date(email.received_at).toUTCString()}`,
    `From: ${formatAddress(email.from)}`,
    `To: ${email.to.map(formatAddress).join(", ")}`,
    `Subject: ${email.subject}`,
    "MIME-Version: 1.0",
  ];
  const textPart = [
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    encodeBase64Text(email.text_body ?? ""),
  ].join("\r\n");
  const htmlPart = [
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "",
    encodeBase64Text(email.html_body ?? ""),
  ].join("\r\n");
  const alternativeBody = [
    `--${alternativeBoundary}`,
    textPart,
    `--${alternativeBoundary}`,
    htmlPart,
    `--${alternativeBoundary}--`,
  ].join("\r\n");
  const bodyContentType = hasAlternativeBodies(email)
    ? `multipart/alternative; boundary="${alternativeBoundary}"`
    : email.html_body !== null
      ? 'text/html; charset="utf-8"'
      : 'text/plain; charset="utf-8"';
  const singleBody = hasAlternativeBodies(email)
    ? alternativeBody
    : encodeBase64Text(email.html_body ?? email.text_body ?? "");

  if (email.attachments.length === 0) {
    return [
      ...headerLines,
      `Content-Type: ${bodyContentType}`,
      ...(hasAlternativeBodies(email)
        ? []
        : ["Content-Transfer-Encoding: base64"]),
      "",
      singleBody,
    ].join("\r\n");
  }

  const attachmentSections = email.attachments.map((attachment) =>
    [
      `--${mixedBoundary}`,
      `Content-Type: ${attachment.content_type}; name="${attachment.filename}"`,
      `Content-Disposition: ${attachment.is_inline ? "inline" : "attachment"}; filename="${attachment.filename}"`,
      ...(attachment.content_id
        ? [`Content-ID: <${attachment.content_id}>`]
        : []),
      "Content-Transfer-Encoding: base64",
      "",
      "(attachment content omitted in demo data)",
    ].join("\r\n"),
  );

  return [
    ...headerLines,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    "",
    `--${mixedBoundary}`,
    `Content-Type: ${bodyContentType}`,
    "",
    singleBody,
    ...attachmentSections,
    `--${mixedBoundary}--`,
  ].join("\r\n");
}
