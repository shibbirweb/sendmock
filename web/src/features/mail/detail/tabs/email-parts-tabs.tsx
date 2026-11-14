import { DownloadIcon, FileIcon } from "lucide-react";

import { IconButton } from "@/components/common/icon-button";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmailMimeTree } from "@/lib/api/hooks/use-email-detail-queries";
import { buildApiUrl } from "@/lib/api/api-client";
import type {
  EmailDetail,
  EmailTimelineEntry,
  MimePart,
} from "@/lib/api/types";
import { formatBytes, formatDateTime } from "@/lib/format/format-values";

function toAppUrl(apiUrl: string): string {
  return buildApiUrl(apiUrl.replace(/^\/api\/v1/, ""));
}

export function EmailAttachmentsTab({ email }: { email: EmailDetail }) {
  if (email.attachments.length === 0) {
    return <p className="text-sm text-muted-foreground">No attachments.</p>;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {email.attachments.map((attachment) => (
        <li
          key={attachment.index}
          className="overflow-hidden rounded-md border"
        >
          <div className="flex h-28 items-center justify-center bg-muted/40">
            {attachment.thumbnail_url ? (
              <img
                src={toAppUrl(attachment.thumbnail_url)}
                alt={attachment.filename}
                className="h-full w-full object-cover"
              />
            ) : (
              <FileIcon className="size-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex items-center gap-2 p-2">
            <div className="grid min-w-0 flex-1">
              <span className="truncate text-sm font-medium">
                {attachment.filename}
              </span>
              <span className="text-xs text-muted-foreground">
                {attachment.content_type} · {formatBytes(attachment.size_bytes)}
                {attachment.is_inline && " · inline"}
              </span>
            </div>
            <IconButton
              variant="ghost"
              asChild
              label={`Download ${attachment.filename}`}
            >
              <a
                href={toAppUrl(attachment.download_url)}
                download={attachment.filename}
              >
                <DownloadIcon />
              </a>
            </IconButton>
          </div>
        </li>
      ))}
    </ul>
  );
}

function MimePartNode({
  mimePart,
  emailId,
}: {
  mimePart: MimePart;
  emailId: string;
}) {
  const partDetails = [
    mimePart.transfer_encoding,
    mimePart.charset,
    mimePart.content_id && `<${mimePart.content_id}>`,
    formatBytes(mimePart.size_bytes),
  ].filter(Boolean);

  return (
    <li className="grid gap-1">
      <div className="flex items-center gap-2 text-sm">
        <code className="font-medium">{mimePart.content_type}</code>
        {mimePart.filename && (
          <span className="text-muted-foreground">{mimePart.filename}</span>
        )}
        <span className="text-xs text-muted-foreground">
          {partDetails.join(" · ")}
        </span>
        {mimePart.children.length === 0 && (
          <IconButton
            variant="ghost"
            className="size-7"
            asChild
            label={`Download part ${mimePart.part_id}`}
          >
            <a
              href={toAppUrl(
                `/api/v1/emails/${emailId}/mime/${mimePart.part_id}`,
              )}
              download={mimePart.filename ?? `part-${mimePart.part_id}`}
            >
              <DownloadIcon />
            </a>
          </IconButton>
        )}
      </div>
      {mimePart.children.length > 0 && (
        <ul className="ml-3 grid gap-1 border-l pl-3">
          {mimePart.children.map((childPart) => (
            <MimePartNode
              key={childPart.part_id}
              mimePart={childPart}
              emailId={emailId}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** The multipart structure of the message (EM-04.6). */
export function EmailMimeTab({ email }: { email: EmailDetail }) {
  const mimeTreeQuery = useEmailMimeTree(email.id, true);

  if (mimeTreeQuery.isPending) {
    return <Skeleton className="h-32 w-full" />;
  }
  if (mimeTreeQuery.isError) {
    return (
      <p className="text-sm text-destructive">
        Could not load the MIME structure.
      </p>
    );
  }

  return (
    <ul className="grid gap-1">
      <MimePartNode mimePart={mimeTreeQuery.data} emailId={email.id} />
    </ul>
  );
}

export function EmailTimelineTab({
  timelineEntries,
}: {
  timelineEntries: EmailTimelineEntry[];
}) {
  return (
    <ol className="grid gap-3 border-l pl-4">
      {timelineEntries.map((timelineEntry, entryIndex) => (
        <li
          key={`${timelineEntry.kind}-${entryIndex}`}
          className="relative grid gap-0.5 text-sm"
        >
          <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-primary" />
          <span className="font-medium capitalize">
            {timelineEntry.kind.replaceAll("_", " ")}
          </span>
          <span className="text-muted-foreground">{timelineEntry.detail}</span>
          <time
            dateTime={timelineEntry.at}
            className="text-xs text-muted-foreground"
          >
            {formatDateTime(timelineEntry.at)}
          </time>
        </li>
      ))}
    </ol>
  );
}
