import { DownloadIcon, FileIcon } from "lucide-react";

import {
  isImageMedia,
  resolveSmsMediaUrl,
} from "@/features/sms/media/sms-media-urls";
import type { SmsMedia } from "@/lib/api/types";
import { formatBytes } from "@/lib/format/format-values";
import { cn } from "@/lib/utils";

/** Media in a bubble: image thumbnails, other files as chips (SM-15.4). */
export function SmsMediaGallery({
  mediaItems,
  isOutbound,
}: {
  mediaItems: SmsMedia[];
  isOutbound: boolean;
}) {
  const imageItems = mediaItems.filter(isImageMedia);
  const fileItems = mediaItems.filter((mediaItem) => !isImageMedia(mediaItem));

  return (
    <div
      aria-label="Media"
      className={cn(
        "grid gap-1.5",
        isOutbound ? "justify-items-end" : "justify-items-start",
      )}
    >
      {imageItems.length > 0 && (
        <div
          className={cn("grid gap-1.5", imageItems.length > 1 && "grid-cols-2")}
        >
          {imageItems.map((imageItem) => (
            <a
              key={imageItem.media_index}
              href={resolveSmsMediaUrl(imageItem)}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-xl border bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <img
                src={resolveSmsMediaUrl(imageItem)}
                alt={imageItem.filename ?? "Image"}
                loading="lazy"
                className="max-h-56 w-full max-w-64 object-cover"
              />
            </a>
          ))}
        </div>
      )}
      {fileItems.map((fileItem) => (
        <a
          key={fileItem.media_index}
          href={resolveSmsMediaUrl(fileItem)}
          download={fileItem.filename ?? undefined}
          className="flex max-w-64 items-center gap-2 rounded-lg border bg-background px-2.5 py-1.5 text-xs hover:bg-muted"
        >
          <FileIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 truncate font-medium">
            {fileItem.filename ?? "File"}
          </span>
          {fileItem.size_bytes !== null && (
            <span className="shrink-0 text-muted-foreground">
              {formatBytes(fileItem.size_bytes)}
            </span>
          )}
          <DownloadIcon className="size-3.5 shrink-0 text-muted-foreground" />
        </a>
      ))}
    </div>
  );
}
