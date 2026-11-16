import { Link } from "@tanstack/react-router";

import {
  CheckableTableRow,
  CheckColumnHead,
} from "@/components/common/checkable-table-row";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pushProviderLabels } from "@/features/push/push-labels";
import { PushStatusBadge } from "@/features/push/push-status-badge";
import type { CheckedItems } from "@/hooks/use-checked-items";
import type { PushNotification } from "@/lib/api/types";
import { formatDateTime, formatRelativeTime } from "@/lib/format/format-values";
import { cn } from "@/lib/utils";

function PushRow({
  pushNotification,
  checkedPushes,
}: {
  pushNotification: PushNotification;
  checkedPushes: CheckedItems;
}) {
  const isUnread = !pushNotification.is_read;

  return (
    <CheckableTableRow
      itemId={pushNotification.id}
      itemLabel={`push to ${pushNotification.device_token}`}
      checkedItems={checkedPushes}
    >
      <TableCell className="max-w-40 sm:max-w-64">
        <Link
          to="/push"
          search={(previousSearch) => ({
            ...previousSearch,
            push: pushNotification.id,
          })}
          className={cn(
            "block truncate after:absolute after:inset-0 focus-visible:outline-none",
            isUnread ? "font-semibold" : "font-medium",
          )}
        >
          {isUnread && <span className="sr-only">Unread: </span>}
          {pushNotification.title ?? pushNotification.body ?? "(no text)"}
        </Link>
      </TableCell>
      <TableCell className="hidden max-w-48 truncate font-mono text-xs text-muted-foreground md:table-cell">
        {pushNotification.device_token}
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        {pushProviderLabels[pushNotification.provider]}
      </TableCell>
      <TableCell>
        <PushStatusBadge pushStatus={pushNotification.status} />
      </TableCell>
      <TableCell className="hidden text-muted-foreground sm:table-cell">
        <time
          dateTime={pushNotification.created_at}
          title={formatDateTime(pushNotification.created_at)}
          className="whitespace-nowrap"
        >
          {formatRelativeTime(pushNotification.created_at)}
        </time>
      </TableCell>
    </CheckableTableRow>
  );
}

/** Push notifications, newest first; a row opens its drawer. */
export function PushTable({
  pushNotifications,
  checkedPushes,
}: {
  pushNotifications: PushNotification[];
  checkedPushes: CheckedItems;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <CheckColumnHead />
          <TableHead>Notification</TableHead>
          <TableHead className="hidden md:table-cell">Device token</TableHead>
          <TableHead className="hidden sm:table-cell">Provider</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden sm:table-cell">Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pushNotifications.map((pushNotification) => (
          <PushRow
            key={pushNotification.id}
            pushNotification={pushNotification}
            checkedPushes={checkedPushes}
          />
        ))}
      </TableBody>
    </Table>
  );
}
