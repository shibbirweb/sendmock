const contentTypesByExtension: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  webp: "image/webp",
  txt: "text/plain",
  csv: "text/csv",
  html: "text/html",
  json: "application/json",
  zip: "application/zip",
  ics: "text/calendar",
  vcf: "text/vcard",
  mp4: "video/mp4",
  mp3: "audio/mpeg",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/;

/** A base64 file as sent in a request (email attachment or SMS media). */
export type InlineFile = {
  filename: string;
  content: string;
  content_type?: string;
};

export type ParsedInlineFile = {
  filename: string;
  content_type: string;
  size_bytes: number;
  fileBytes: Uint8Array;
};

export type InlineFileLimits = {
  /** Name used in error messages, e.g. `attachments` or `media`. */
  fieldName: string;
  maxTotalBytes: number;
  /** Message when the total size goes over the limit. */
  sizeLimitMessage: (fileIndex: number) => string;
};

export type InlineFilesResult<ParsedFile> =
  | { isValid: true; files: ParsedFile[] }
  | { isValid: false; errorMessage: string };

/** "invoice.pdf" to "application/pdf", or the generic binary type. */
export function guessContentType(filename: string): string {
  const fileExtension = filename.split(".").pop()?.toLowerCase() ?? "";

  return contentTypesByExtension[fileExtension] ?? "application/octet-stream";
}

/** Decodes standard base64, ignoring line breaks; null when it is not base64. */
export function decodeBase64(encodedContent: string): Uint8Array | null {
  const compactContent = encodedContent.replace(/\s+/g, "");
  if (!base64Pattern.test(compactContent) || compactContent.length % 4 === 1) {
    return null;
  }

  try {
    const paddedContent = compactContent.padEnd(
      Math.ceil(compactContent.length / 4) * 4,
      "=",
    );

    return Uint8Array.from(atob(paddedContent), (binaryCharacter) =>
      binaryCharacter.charCodeAt(0),
    );
  } catch {
    return null;
  }
}

/** Checks and decodes base64 files; errors name the item, as the server does. */
export function parseInlineFiles(
  inlineFiles: InlineFile[] | undefined,
  inlineFileLimits: InlineFileLimits,
): InlineFilesResult<ParsedInlineFile> {
  const parsedFiles: ParsedInlineFile[] = [];
  let totalSizeBytes = 0;

  for (const [fileIndex, inlineFile] of (inlineFiles ?? []).entries()) {
    const fieldPrefix = `${inlineFileLimits.fieldName}[${fileIndex}]`;
    const filename = (inlineFile.filename ?? "").trim();
    if (filename === "") {
      return {
        isValid: false,
        errorMessage: `${fieldPrefix}.filename is required`,
      };
    }

    const fileBytes = decodeBase64(inlineFile.content ?? "");
    if (fileBytes === null) {
      return {
        isValid: false,
        errorMessage: `${fieldPrefix}.content is not valid base64`,
      };
    }

    totalSizeBytes += fileBytes.length;
    if (totalSizeBytes > inlineFileLimits.maxTotalBytes) {
      return {
        isValid: false,
        errorMessage: inlineFileLimits.sizeLimitMessage(fileIndex),
      };
    }

    parsedFiles.push({
      filename,
      content_type:
        inlineFile.content_type?.trim() || guessContentType(filename),
      size_bytes: fileBytes.length,
      fileBytes,
    });
  }

  return { isValid: true, files: parsedFiles };
}
