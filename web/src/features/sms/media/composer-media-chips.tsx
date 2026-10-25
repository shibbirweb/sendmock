import { FileIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ComposerMediaFile } from "@/features/sms/media/use-composer-media";
import { formatBytes } from "@/lib/format/format-values";

/** Files waiting to be sent with the reply, each removable. */
export function ComposerMediaChips({
  mediaFiles,
  onRemove,
}: {
  mediaFiles: ComposerMediaFile[];
  onRemove: (fileId: number) => void;
}) {
  if (mediaFiles.length === 0) {
    return null;
  }

  return (
    <ul aria-label="Files to send" className="flex flex-wrap gap-2">
      {mediaFiles.map(({ fileId, file, previewUrl }) => (
        <li
          key={fileId}
          className="flex items-center gap-2 rounded-lg border bg-muted/40 py-1 pr-1 pl-1.5 text-xs"
        >
          {previewUrl === null ? (
            <FileIcon className="size-4 text-muted-foreground" />
          ) : (
            <img
              src={previewUrl}
              alt=""
              className="size-8 rounded object-cover"
            />
          )}
          <span className="max-w-32 truncate font-medium">{file.name}</span>
          <span className="text-muted-foreground">
            {formatBytes(file.size)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            aria-label={`Remove ${file.name}`}
            onClick={() => onRemove(fileId)}
          >
            <XIcon className="size-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
