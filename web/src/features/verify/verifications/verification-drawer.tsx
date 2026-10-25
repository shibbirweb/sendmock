import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ExternalLinkIcon } from "lucide-react";
import type * as React from "react";

import { CopyButton } from "@/components/common/copy-button";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ExpiryCountdown } from "@/features/verify/verifications/expiry-countdown";
import { useCurrentTimeMs } from "@/features/verify/verifications/use-current-time";
import { VerificationForceButtons } from "@/features/verify/verifications/verification-force-buttons";
import { VerificationStatusBadge } from "@/features/verify/verifications/verification-status-badge";
import { VerificationTimeline } from "@/features/verify/verifications/verification-timeline";
import { verifyChannelLabels } from "@/features/verify/verify-labels";
import { useVerification } from "@/lib/api/hooks/use-verify-queries";
import {
  maxVerificationCheckAttempts,
  type VerificationDetail,
} from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/format-values";

function VerificationFact({
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

/** The captured SMS or email that carried the code (VF-04.4). */
function LinkedMessageButton({
  verification,
}: {
  verification: VerificationDetail;
}) {
  if (verification.linked_message_id === null) {
    return null;
  }
  if (verification.channel === "email") {
    return (
      <Button variant="outline" size="sm" asChild>
        <Link
          to="/mail/$emailId"
          params={{ emailId: verification.linked_message_id }}
        >
          <ExternalLinkIcon />
          Open the email
        </Link>
      </Button>
    );
  }
  if (verification.linked_thread_id === null) {
    return null;
  }

  return (
    <Button variant="outline" size="sm" asChild>
      <Link
        to="/sms/$threadId"
        params={{ threadId: verification.linked_thread_id }}
        search={{ message: verification.linked_message_id }}
      >
        <ExternalLinkIcon />
        Open the message
      </Link>
    </Button>
  );
}

function VerificationDrawerBody({
  verification,
}: {
  verification: VerificationDetail;
}) {
  const isPending = verification.status === "pending";
  const currentTimeMs = useCurrentTimeMs(isPending);

  return (
    <div className="grid gap-4 px-4 pb-6">
      <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-4">
        <span className="font-mono text-3xl font-semibold tracking-[0.3em]">
          {verification.code}
        </span>
        <CopyButton copyText={verification.code} label="Copy code" />
        <span className="ml-auto">
          <VerificationStatusBadge verificationStatus={verification.status} />
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <VerificationFact label="To">{verification.to}</VerificationFact>
        <VerificationFact label="Channel">
          {verifyChannelLabels[verification.channel]}
        </VerificationFact>
        <VerificationFact label="Service">
          {verification.service_name}
        </VerificationFact>
        <VerificationFact label="Attempts">
          {verification.check_attempts} of {maxVerificationCheckAttempts} checks
        </VerificationFact>
        <VerificationFact label="Created">
          {formatDateTime(verification.created_at)}
        </VerificationFact>
        <VerificationFact label="Expiry">
          {isPending ? (
            <ExpiryCountdown
              expiresAt={verification.expires_at}
              currentTimeMs={currentTimeMs}
            />
          ) : (
            formatDateTime(verification.expires_at)
          )}
        </VerificationFact>
        <VerificationFact label="SID">
          <span className="font-mono text-xs">{verification.sid}</span>
        </VerificationFact>
      </dl>
      <div>
        <LinkedMessageButton verification={verification} />
      </div>
      {isPending && (
        <>
          <Separator />
          <VerificationForceButtons verificationSid={verification.sid} />
        </>
      )}
      <Separator />
      <VerificationTimeline timelineEntries={verification.timeline} />
    </div>
  );
}

function VerificationDrawerContent({
  verificationSid,
}: {
  verificationSid: string;
}) {
  const verificationQuery = useVerification(verificationSid);

  if (verificationQuery.isPending) {
    return (
      <div className="grid gap-3 px-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (verificationQuery.isError) {
    return (
      <p className="px-4 text-sm text-destructive">
        Could not load this verification. It may have been pruned.
      </p>
    );
  }

  return <VerificationDrawerBody verification={verificationQuery.data} />;
}

/** Details of one verification, open while `?verification=` is set. */
export function VerificationDrawer() {
  const { verification: openVerificationSid } = useSearch({
    from: "/sms/verify",
  });
  const navigate = useNavigate({ from: "/sms/verify" });

  return (
    <Sheet
      open={openVerificationSid !== undefined}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          void navigate({
            search: (previousSearch) => ({
              ...previousSearch,
              verification: undefined,
            }),
          });
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Verification</SheetTitle>
          <SheetDescription>
            Code, attempts and everything that happened to it.
          </SheetDescription>
        </SheetHeader>
        {openVerificationSid !== undefined && (
          <VerificationDrawerContent verificationSid={openVerificationSid} />
        )}
      </SheetContent>
    </Sheet>
  );
}
