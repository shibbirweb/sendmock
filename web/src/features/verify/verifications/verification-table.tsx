import { Link } from "@tanstack/react-router";

import { CopyButton } from "@/components/common/copy-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExpiryCountdown } from "@/features/verify/verifications/expiry-countdown";
import { VerificationStatusBadge } from "@/features/verify/verifications/verification-status-badge";
import {
  verifyChannelIcons,
  verifyChannelLabels,
} from "@/features/verify/verify-labels";
import {
  type Verification,
  maxVerificationCheckAttempts,
} from "@/lib/api/types";
import { formatDateTime, formatRelativeTime } from "@/lib/format/format-values";

type VerificationTableProps = {
  verifications: Verification[];
  currentTimeMs: number;
  onCodeExpired: () => void;
};

function VerificationRow({
  verification,
  currentTimeMs,
  onCodeExpired,
}: { verification: Verification } & Omit<
  VerificationTableProps,
  "verifications"
>) {
  const ChannelIcon = verifyChannelIcons[verification.channel];

  return (
    <TableRow className="relative">
      <TableCell className="max-w-36 font-medium sm:max-w-48">
        <span className="flex min-w-0 items-center gap-1.5">
          {/* On phones the channel column hides, so its icon moves here. */}
          <ChannelIcon
            className="size-4 shrink-0 text-muted-foreground sm:hidden"
            aria-label={verifyChannelLabels[verification.channel]}
          />
          <Link
            to="/sms/verify"
            search={{ verification: verification.sid }}
            className="truncate after:absolute after:inset-0 focus-visible:outline-none"
          >
            {verification.to}
          </Link>
        </span>
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <span className="flex items-center gap-1.5">
          <ChannelIcon
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
          {verifyChannelLabels[verification.channel]}
        </span>
      </TableCell>
      <TableCell className="hidden max-w-48 truncate text-muted-foreground md:table-cell">
        {verification.service_name}
      </TableCell>
      <TableCell>
        <span className="flex items-center gap-1">
          <span className="font-mono font-semibold tracking-widest">
            {verification.code}
          </span>
          <CopyButton
            copyText={verification.code}
            label={`Copy code ${verification.code}`}
            className="relative z-10 size-6"
          />
        </span>
      </TableCell>
      <TableCell>
        <VerificationStatusBadge verificationStatus={verification.status} />
      </TableCell>
      <TableCell className="hidden tabular-nums md:table-cell">
        {verification.check_attempts} / {maxVerificationCheckAttempts}
      </TableCell>
      <TableCell className="hidden text-muted-foreground sm:table-cell">
        {verification.status === "pending" ? (
          <ExpiryCountdown
            expiresAt={verification.expires_at}
            currentTimeMs={currentTimeMs}
            onExpired={onCodeExpired}
          />
        ) : (
          <time
            dateTime={verification.created_at}
            title={formatDateTime(verification.created_at)}
            className="whitespace-nowrap"
          >
            {formatRelativeTime(verification.created_at)}
          </time>
        )}
      </TableCell>
    </TableRow>
  );
}

/** Verifications, newest first; a row opens its drawer. */
export function VerificationTable({
  verifications,
  currentTimeMs,
  onCodeExpired,
}: VerificationTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>To</TableHead>
          <TableHead className="hidden sm:table-cell">Channel</TableHead>
          <TableHead className="hidden md:table-cell">Service</TableHead>
          <TableHead>Code</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Attempts</TableHead>
          <TableHead className="hidden sm:table-cell">Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {verifications.map((verification) => (
          <VerificationRow
            key={verification.sid}
            verification={verification}
            currentTimeMs={currentTimeMs}
            onCodeExpired={onCodeExpired}
          />
        ))}
      </TableBody>
    </Table>
  );
}
