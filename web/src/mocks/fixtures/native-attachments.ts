import type { NativeSendAttachment } from "@/lib/api/types";
import {
  guessContentType,
  type ParsedInlineFile,
  parseInlineFiles,
} from "@/mocks/fixtures/inline-files";

export { guessContentType };

/** The 25 MB message size limit that attachments count towards. */
export const maxMessageSizeBytes = 25 * 1024 * 1024;

export type ParsedNativeAttachment = ParsedInlineFile & {
  content_id: string | null;
  is_inline: boolean;
};

export type NativeAttachmentsResult =
  | { isValid: true; attachments: ParsedNativeAttachment[] }
  | { isValid: false; errorMessage: string };

/**
 * Checks and decodes `attachments` of a native send (EM-07.4, EM-07.5).
 * Errors name the attachment, as the server does.
 */
export function parseNativeAttachments(
  nativeAttachments: NativeSendAttachment[] | undefined,
): NativeAttachmentsResult {
  const filesResult = parseInlineFiles(nativeAttachments, {
    fieldName: "attachments",
    maxTotalBytes: maxMessageSizeBytes,
    sizeLimitMessage: (fileIndex) =>
      `attachments[${fileIndex}] goes over the 25 MB message size limit`,
  });
  if (!filesResult.isValid) {
    return filesResult;
  }

  return {
    isValid: true,
    attachments: filesResult.files.map((parsedFile, fileIndex) => {
      const contentId =
        nativeAttachments?.[fileIndex]?.content_id?.trim() || null;

      return {
        ...parsedFile,
        content_id: contentId,
        is_inline: contentId !== null,
      };
    }),
  };
}
