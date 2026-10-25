import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { CircleAlertIcon, ExternalLinkIcon } from "lucide-react";
import type * as React from "react";

import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { SmtpResultBadge } from "@/features/logs/smtp/smtp-result-badge";
import { SmtpTranscript } from "@/features/logs/smtp/smtp-transcript";
import { useSmtpSession } from "@/lib/api/hooks/use-logs-queries";
import type { SmtpSession } from "@/lib/api/types";
import { formatDateTime, formatDurationMs } from "@/lib/format/format-values";

function SessionFact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function SmtpSessionDetails({ smtpSession }: { smtpSession: SmtpSession }) {
  const durationMs =
    Date.parse(smtpSession.ended_at) - Date.parse(smtpSession.started_at);
  const firstEmailId = smtpSession.email_ids[0] ?? null;

  return (
    <div className="grid gap-4 px-4 pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <SmtpResultBadge sessionResult={smtpSession.result} />
        <span className="text-sm text-muted-foreground">
          {formatDateTime(smtpSession.started_at)}, took{" "}
          {formatDurationMs(durationMs)}
        </span>
      </div>
      {smtpSession.failure_reason !== null && (
        <p className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
          {smtpSession.failure_reason}
        </p>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <SessionFact label="Client">
          <span className="font-mono">{smtpSession.remote_address}</span>
        </SessionFact>
        <SessionFact label="EHLO">{smtpSession.helo_name}</SessionFact>
        <SessionFact label="TLS">
          {smtpSession.tls_version ?? "Plain"}
        </SessionFact>
        <SessionFact label="AUTH">
          {smtpSession.auth_user === null
            ? "None"
            : `${smtpSession.auth_user} (${smtpSession.auth_mechanism ?? "unknown"})`}
        </SessionFact>
        <SessionFact label="Emails">
          {smtpSession.email_ids.length === 0
            ? "None stored"
            : `${smtpSession.email_ids.length} stored`}
        </SessionFact>
      </dl>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Transcript</h3>
        <div className="flex items-center gap-1">
          {firstEmailId !== null && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/mail/$emailId" params={{ emailId: firstEmailId }}>
                <ExternalLinkIcon />
                Open email
              </Link>
            </Button>
          )}
          <CopyButton
            copyText={smtpSession.transcript}
            label="Copy transcript"
          />
        </div>
      </div>
      <SmtpTranscript
        transcript={smtpSession.transcript}
        firstEmailId={firstEmailId}
      />
      <p className="text-xs text-muted-foreground">
        AUTH secrets are masked, and the message content is not repeated here:
        it is stored as the email.
      </p>
    </div>
  );
}

function SmtpSessionDrawerContent({ sessionId }: { sessionId: string }) {
  const sessionQuery = useSmtpSession(sessionId);

  if (sessionQuery.isPending) {
    return (
      <div className="grid gap-3 px-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (sessionQuery.isError) {
    return (
      <p className="px-4 text-sm text-destructive">
        This session is no longer in the log. It may have been pruned.
      </p>
    );
  }

  return <SmtpSessionDetails smtpSession={sessionQuery.data} />;
}

/** One SMTP session and its transcript, open while `?session=` is set. */
export function SmtpSessionDrawer() {
  const { session: openSessionId } = useSearch({ from: "/logs" });
  const navigate = useNavigate({ from: "/logs" });

  return (
    <Sheet
      open={openSessionId !== undefined}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          void navigate({
            search: (previousSearch) => ({
              ...previousSearch,
              session: undefined,
            }),
          });
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>SMTP session</SheetTitle>
          <SheetDescription>
            Every command your app sent and every reply SendMock gave.
          </SheetDescription>
        </SheetHeader>
        {openSessionId !== undefined && (
          <SmtpSessionDrawerContent sessionId={openSessionId} />
        )}
      </SheetContent>
    </Sheet>
  );
}
