import { Link } from "@tanstack/react-router";
import { KeyRoundIcon, PaperclipIcon } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { emailSourceLabels } from "@/features/mail/mail-labels";
import { EmailOutcomeBadge } from "@/features/mail/email-outcome-badge";
import type { EmailSummary } from "@/lib/api/types";
import { formatDateTime, formatRelativeTime } from "@/lib/format/format-values";
import { cn } from "@/lib/utils";

type MailListItemProps = {
  email: EmailSummary;
  isSelected: boolean;
  isChecked: boolean;
  onCheckedChange: (isChecked: boolean) => void;
};

/** One row of the mail list; a fixed height keeps the virtual list fast. */
export function MailListItem({
  email,
  isSelected,
  isChecked,
  onCheckedChange,
}: MailListItemProps) {
  const senderLabel = email.from.name || email.from.address;

  return (
    <div
      className={cn(
        "group/mail-row relative flex h-full gap-2 border-b px-3 py-2.5 hover:bg-muted/60",
        isSelected && "bg-muted",
      )}
    >
      <div className="flex w-4 shrink-0 flex-col items-center gap-2 pt-0.5">
        <Checkbox
          checked={isChecked}
          onCheckedChange={(checkedState) => {
            onCheckedChange(checkedState === true);
          }}
          aria-label={`Select email from ${senderLabel}`}
          className={cn(
            "relative z-10 opacity-0 group-hover/mail-row:opacity-100 focus-visible:opacity-100",
            isChecked && "opacity-100",
          )}
        />
        {!email.is_read && (
          <span
            aria-label="Unread"
            className="size-2 rounded-full bg-primary"
          />
        )}
      </div>
      <Link
        to="/mail/$emailId"
        params={{ emailId: email.id }}
        search={(previousSearch) => previousSearch}
        aria-current={isSelected ? "true" : undefined}
        className="flex min-w-0 flex-1 flex-col gap-0.5 after:absolute after:inset-0"
      >
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <span
            className={cn(
              "min-w-0 truncate",
              !email.is_read && "font-semibold",
            )}
          >
            {senderLabel}
          </span>
          <time
            dateTime={email.received_at}
            title={formatDateTime(email.received_at)}
            className="ml-auto shrink-0 text-xs text-muted-foreground"
          >
            {formatRelativeTime(email.received_at)}
          </time>
        </span>
        <span
          className={cn(
            "min-w-0 truncate text-sm",
            !email.is_read ? "font-medium" : "text-muted-foreground",
          )}
        >
          {email.subject || "(no subject)"}
        </span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          {email.has_otp && (
            <KeyRoundIcon className="size-3 shrink-0" aria-label="Has a code" />
          )}
          {email.attachment_count > 0 && (
            <PaperclipIcon
              className="size-3 shrink-0"
              aria-label="Has attachments"
            />
          )}
          <span className="min-w-0 truncate">{email.snippet}</span>
          {email.source !== "smtp" && (
            <span className="shrink-0 rounded border px-1 text-[10px] uppercase">
              {emailSourceLabels[email.source]}
            </span>
          )}
          <EmailOutcomeBadge deliveryStatus={email.delivery_status} />
        </span>
      </Link>
    </div>
  );
}
