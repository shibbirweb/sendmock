import { Link } from "@tanstack/react-router";
import { ArrowLeftIcon, EyeIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MailDetailActions } from "@/features/mail/detail/mail-detail-actions";
import { EmailOutcomeBadge } from "@/features/mail/email-outcome-badge";
import { emailSourceLabels } from "@/features/mail/mail-labels";
import type { EmailAddress, EmailDetail } from "@/lib/api/types";
import { formatDateTime, formatRelativeTime } from "@/lib/format/format-values";

function formatAddressList(emailAddresses: EmailAddress[]): string {
  return emailAddresses
    .map((emailAddress) =>
      emailAddress.name
        ? `${emailAddress.name} <${emailAddress.address}>`
        : emailAddress.address,
    )
    .join(", ");
}

export function MailDetailHeader({ email }: { email: EmailDetail }) {
  const addressRows = [
    { label: "From", value: formatAddressList([email.from]) },
    { label: "To", value: formatAddressList(email.to) },
    { label: "Cc", value: formatAddressList(email.cc) },
    { label: "Bcc", value: formatAddressList(email.bcc) },
  ].filter((addressRow) => addressRow.value !== "");

  return (
    <header className="grid gap-3 border-b px-4 py-4 sm:px-6">
      <div className="flex items-start gap-2">
        <Button variant="ghost" size="icon" className="-ml-2 md:hidden" asChild>
          <Link
            to="/mail"
            search={(previousSearch) => previousSearch}
            aria-label="Back to the list"
          >
            <ArrowLeftIcon />
          </Link>
        </Button>
        <h2 className="min-w-0 flex-1 text-lg leading-snug font-semibold break-words">
          {email.subject || "(no subject)"}
        </h2>
        <MailDetailActions email={email} />
      </div>
      <dl className="grid grid-cols-[3rem_1fr] gap-x-2 gap-y-0.5 text-sm">
        {addressRows.map((addressRow) => (
          <div key={addressRow.label} className="contents">
            <dt className="text-muted-foreground">{addressRow.label}</dt>
            <dd className="min-w-0 break-words">{addressRow.value}</dd>
          </div>
        ))}
        <dt className="text-muted-foreground">Date</dt>
        <dd>
          <time dateTime={email.received_at}>
            {formatDateTime(email.received_at)}
          </time>
        </dd>
      </dl>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{emailSourceLabels[email.source]}</Badge>
        {email.tags.map((tagName) => (
          <Badge key={tagName} variant="secondary">
            {tagName}
          </Badge>
        ))}
        <EmailOutcomeBadge deliveryStatus={email.delivery_status} />
        {email.open_count > 0 && email.opened_at !== null && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <EyeIcon className="size-3.5" />
            Opened {email.open_count} time{email.open_count === 1 ? "" : "s"},
            first {formatRelativeTime(email.opened_at)}
          </span>
        )}
      </div>
    </header>
  );
}
