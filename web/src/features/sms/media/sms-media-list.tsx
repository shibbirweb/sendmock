import { DownloadIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  isImageMedia,
  resolveSmsMediaUrl,
} from "@/features/sms/media/sms-media-urls";
import type { SmsMedia } from "@/lib/api/types";
import { formatBytes } from "@/lib/format/format-values";

/** Every media file of a message, for the message drawer (SM-15.4). */
export function SmsMediaList({ mediaItems }: { mediaItems: SmsMedia[] }) {
  return (
    <section aria-label="Message media" className="grid gap-2">
      <h3 className="text-sm font-medium">Media ({mediaItems.length})</h3>
      <ul className="grid gap-2">
        {mediaItems.map((mediaItem) => (
          <li
            key={mediaItem.media_index}
            className="flex items-center gap-3 rounded-md border p-2"
          >
            {isImageMedia(mediaItem) ? (
              <img
                src={resolveSmsMediaUrl(mediaItem)}
                alt=""
                className="size-12 shrink-0 rounded object-cover"
              />
            ) : (
              <span className="flex size-12 shrink-0 items-center justify-center rounded bg-muted font-mono text-[10px] uppercase">
                {mediaItem.content_type.split("/").pop()}
              </span>
            )}
            <span className="grid min-w-0 flex-1 gap-0.5 text-sm">
              <span className="truncate font-medium">
                {mediaItem.filename ?? "Untitled"}
              </span>
              <span className="text-xs text-muted-foreground">
                {mediaItem.content_type}
                {mediaItem.size_bytes !== null &&
                  `, ${formatBytes(mediaItem.size_bytes)}`}
              </span>
              {mediaItem.source_url !== null && (
                <span
                  className="truncate font-mono text-xs text-muted-foreground"
                  title={mediaItem.source_url}
                >
                  From {mediaItem.source_url}
                </span>
              )}
            </span>
            <Button variant="ghost" size="icon-sm" asChild>
              <a
                href={resolveSmsMediaUrl(mediaItem)}
                download={mediaItem.filename ?? undefined}
                aria-label={`Download ${mediaItem.filename ?? "media"}`}
              >
                <DownloadIcon />
              </a>
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
