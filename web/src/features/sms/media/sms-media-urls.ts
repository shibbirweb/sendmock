import { buildApiUrl } from "@/lib/api/api-client";
import type { SmsMedia } from "@/lib/api/types";

/** Full URL of SendMock's copy of a media file. */
export function resolveSmsMediaUrl(smsMedia: Pick<SmsMedia, "url">): string {
  return buildApiUrl(smsMedia.url.replace(/^\/api\/v1/, ""));
}

export function isImageMedia(
  smsMedia: Pick<SmsMedia, "content_type">,
): boolean {
  return smsMedia.content_type.startsWith("image/");
}

/** "Photo" or "Attachment", for previews of messages without text. */
export function describeMediaOnlyMessage(mediaItems: SmsMedia[]): string {
  const imageCount = mediaItems.filter(isImageMedia).length;
  if (imageCount === mediaItems.length) {
    return imageCount === 1 ? "Photo" : `${imageCount} photos`;
  }

  return mediaItems.length === 1
    ? "Attachment"
    : `${mediaItems.length} attachments`;
}
