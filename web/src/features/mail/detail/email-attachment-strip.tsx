import { DownloadIcon, FileIcon, PaperclipIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toAppUrl } from "@/features/mail/detail/tabs/email-parts-tabs";
import type { EmailAttachment } from "@/lib/api/types";
import { formatBytes } from "@/lib/format/format-values";

function describeAttachmentCount(attachmentCount: number): string {
  return attachmentCount === 1
    ? "1 attachment"
    : `${attachmentCount} attachments`;
}

function AttachmentChip({ attachment }: { attachment: EmailAttachment }) {
  const sizeAndKind = [
    formatBytes(attachment.size_bytes),
    attachment.is_inline && "inline",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="min-w-0">
      <Button
        variant="outline"
        className="h-auto max-w-72 justify-start py-1.5"
        asChild
      >
        <a
          href={toAppUrl(attachment.download_url)}
          download={attachment.filename}
          aria-label={`Download ${attachment.filename}`}
          title={`${attachment.filename} (${attachment.content_type})`}
        >
          {attachment.thumbnail_url ? (
            <img
              src={toAppUrl(attachment.thumbnail_url)}
              alt=""
              className="size-6 shrink-0 rounded-sm object-cover"
            />
          ) : (
            <FileIcon className="text-muted-foreground" />
          )}
          <span className="truncate font-medium">{attachment.filename}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {sizeAndKind}
          </span>
          <DownloadIcon className="text-muted-foreground" />
        </a>
      </Button>
    </li>
  );
}

/** The email's attachments under the message body, so they show without opening their tab. */
export function EmailAttachmentStrip({
  attachments,
}: {
  attachments: EmailAttachment[];
}) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <section aria-label="Attachments" className="mt-4 grid gap-2">
      <h3 className="flex items-center gap-1.5 text-sm font-medium">
        <PaperclipIcon className="size-4 text-muted-foreground" />
        {describeAttachmentCount(attachments.length)}
      </h3>
      <ul className="flex flex-wrap gap-2">
        {attachments.map((attachment) => (
          <AttachmentChip key={attachment.index} attachment={attachment} />
        ))}
      </ul>
    </section>
  );
}
