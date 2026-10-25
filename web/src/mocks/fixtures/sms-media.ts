import type { NativeSmsRequest, SmsMedia } from "@/lib/api/types";
import {
  guessContentType,
  type ParsedInlineFile,
  parseInlineFiles,
} from "@/mocks/fixtures/inline-files";

/** Twilio's MMS limits, used for every API (SM-15.3). */
export const maxSmsMediaCount = 10;
export const maxSmsMediaBytes = 5 * 1024 * 1024;

export type ParsedSmsMedia = {
  /** Metadata without the message-specific `url` and index. */
  mediaFields: Omit<SmsMedia, "media_index" | "url">;
  /** Null for URL media, which the browser demo cannot download. */
  fileBytes: Uint8Array | null;
};

export type SmsMediaResult =
  | { isValid: true; media: ParsedSmsMedia[] }
  | { isValid: false; errorMessage: string };

function readUrlFilename(mediaUrl: string): string | null {
  try {
    return new URL(mediaUrl).pathname.split("/").pop() || null;
  } catch {
    return null;
  }
}

/** Checks `media_urls` and inline `media` together against the MMS limits. */
export function parseSmsMedia(
  smsRequest: Pick<NativeSmsRequest, "media_urls" | "media">,
): SmsMediaResult {
  const mediaUrls = smsRequest.media_urls ?? [];
  const inlineMedia = smsRequest.media ?? [];
  if (mediaUrls.length + inlineMedia.length > maxSmsMediaCount) {
    return {
      isValid: false,
      errorMessage: `A message can carry at most ${maxSmsMediaCount} media items`,
    };
  }

  for (const [urlIndex, mediaUrl] of mediaUrls.entries()) {
    if (!/^https?:\/\//.test(mediaUrl)) {
      return {
        isValid: false,
        errorMessage: `media_urls[${urlIndex}] is not an http or https URL`,
      };
    }
  }

  const filesResult = parseInlineFiles(inlineMedia, {
    fieldName: "media",
    maxTotalBytes: maxSmsMediaBytes,
    sizeLimitMessage: () => "media goes over the 5 MB limit",
  });
  if (!filesResult.isValid) {
    return filesResult;
  }

  const urlMedia: ParsedSmsMedia[] = mediaUrls.map((mediaUrl) => {
    const filename = readUrlFilename(mediaUrl);

    return {
      mediaFields: {
        content_type: guessContentType(filename ?? ""),
        size_bytes: null,
        filename,
        source_url: mediaUrl,
      },
      fileBytes: null,
    };
  });
  const decodedMedia: ParsedSmsMedia[] = filesResult.files.map(
    (parsedFile: ParsedInlineFile) => ({
      mediaFields: {
        content_type: parsedFile.content_type,
        size_bytes: parsedFile.size_bytes,
        filename: parsedFile.filename,
        source_url: null,
      },
      fileBytes: parsedFile.fileBytes,
    }),
  );

  return { isValid: true, media: [...urlMedia, ...decodedMedia] };
}

/** Gives parsed media their index and SendMock URL for a stored message. */
export function toSmsMedia(
  smsId: string,
  parsedMedia: ParsedSmsMedia[],
): SmsMedia[] {
  return parsedMedia.map(({ mediaFields }, mediaIndex) => ({
    ...mediaFields,
    media_index: mediaIndex,
    url: `/api/v1/sms/${smsId}/media/${mediaIndex}`,
  }));
}
