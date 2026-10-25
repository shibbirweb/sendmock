import { Link } from "@tanstack/react-router";
import { MailIcon, MessageSquareIcon } from "lucide-react";
import type * as React from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmailList } from "@/lib/api/hooks/use-email-queries";
import { useSmsThreads } from "@/lib/api/hooks/use-sms-queries";
import { formatDateTime, formatRelativeTime } from "@/lib/format/format-values";
import { stripChannelPrefix } from "@/lib/sms/format-phone-number";

const latestMessageLimit = 5;

type LatestMessageTarget =
  { kind: "email"; emailId: string } | { kind: "sms"; threadId: string };

type LatestMessageRow = {
  rowKey: string;
  target: LatestMessageTarget;
  title: string;
  preview: string;
  createdAt: string;
};

const rowLinkClassName =
  "flex items-start gap-2 rounded-md p-2 text-sm hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function useLatestMessageRows() {
  const emailListQuery = useEmailList({ limit: latestMessageLimit });
  const smsThreadsQuery = useSmsThreads();
  const emailRows: LatestMessageRow[] = (emailListQuery.data?.items ?? []).map(
    (emailSummary) => ({
      rowKey: `email-${emailSummary.id}`,
      target: { kind: "email", emailId: emailSummary.id },
      title:
        emailSummary.subject === "" ? "(no subject)" : emailSummary.subject,
      preview: emailSummary.from.name || emailSummary.from.address,
      createdAt: emailSummary.received_at,
    }),
  );
  const smsRows: LatestMessageRow[] = (smsThreadsQuery.data ?? []).map(
    (smsThread) => ({
      rowKey: `sms-${smsThread.thread_id}`,
      target: { kind: "sms", threadId: smsThread.thread_id },
      title: stripChannelPrefix(smsThread.contact_number),
      preview: smsThread.last_message.body,
      createdAt: smsThread.last_message.created_at,
    }),
  );
  const latestRows = [...emailRows, ...smsRows]
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, latestMessageLimit);

  return {
    latestRows,
    isPending: emailListQuery.isPending || smsThreadsQuery.isPending,
  };
}

/** The newest emails and SMS conversations, mixed by time. */
export function LatestMessagesCard() {
  const { latestRows, isPending } = useLatestMessageRows();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Latest messages</CardTitle>
        <CardDescription>The newest emails and SMS.</CardDescription>
      </CardHeader>
      <CardContent>
        {isPending && <Skeleton className="h-40 w-full" />}
        {!isPending && latestRows.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nothing yet. Send an email or SMS from your app to see it here.
          </p>
        )}
        {!isPending && latestRows.length > 0 && (
          <ul aria-label="Latest messages" className="grid gap-1">
            {latestRows.map((latestRow) => (
              <li key={latestRow.rowKey}>
                <LatestMessageLink latestRow={latestRow} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LatestMessageRowLink({
  target,
  children,
}: {
  target: LatestMessageTarget;
  children: React.ReactNode;
}) {
  if (target.kind === "email") {
    return (
      <Link
        to="/mail/$emailId"
        params={{ emailId: target.emailId }}
        className={rowLinkClassName}
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      to="/sms/$threadId"
      params={{ threadId: target.threadId }}
      className={rowLinkClassName}
    >
      {children}
    </Link>
  );
}

function LatestMessageLink({ latestRow }: { latestRow: LatestMessageRow }) {
  const RowIcon =
    latestRow.target.kind === "email" ? MailIcon : MessageSquareIcon;

  return (
    <LatestMessageRowLink target={latestRow.target}>
      <RowIcon
        aria-hidden="true"
        className="mt-0.5 size-4 shrink-0 text-muted-foreground"
      />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate font-medium">
            {latestRow.title}
          </span>
          <time
            dateTime={latestRow.createdAt}
            title={formatDateTime(latestRow.createdAt)}
            className="ml-auto shrink-0 text-xs text-muted-foreground"
          >
            {formatRelativeTime(latestRow.createdAt)}
          </time>
        </span>
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {latestRow.preview}
        </span>
      </span>
    </LatestMessageRowLink>
  );
}
