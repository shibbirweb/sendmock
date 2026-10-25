import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { CopyButton } from "@/components/common/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { numberChannelLabels } from "@/features/numbers/numbers-labels";
import { NumbersEmptyState } from "@/features/numbers/virtual-numbers/numbers-empty-state";
import { VirtualNumberSheet } from "@/features/numbers/virtual-numbers/virtual-number-sheet";
import {
  useDeleteVirtualNumber,
  useMessagingServices,
  useVirtualNumbers,
} from "@/lib/api/hooks/use-numbers-queries";
import type { VirtualNumber } from "@/lib/api/types";

/** Inbound webhook, with the default status callback on a second line. */
function WebhookSummary({ virtualNumber }: { virtualNumber: VirtualNumber }) {
  return (
    <span className="grid min-w-0 gap-0.5">
      {virtualNumber.inbound_url === null ? (
        <span className="text-muted-foreground">Rules only</span>
      ) : (
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 rounded border px-1 font-mono text-[10px]">
            {virtualNumber.inbound_method}
          </span>
          <span className="truncate" title={virtualNumber.inbound_url}>
            {virtualNumber.inbound_url}
          </span>
        </span>
      )}
      {virtualNumber.status_callback_url !== null && (
        <span
          className="truncate text-xs text-muted-foreground"
          title={virtualNumber.status_callback_url}
        >
          Status callback: {virtualNumber.status_callback_url}
        </span>
      )}
    </span>
  );
}

/** The virtual number registry (SM-12). */
export function VirtualNumbersPanel() {
  const numbersQuery = useVirtualNumbers();
  const messagingServicesQuery = useMessagingServices();
  const deleteVirtualNumber = useDeleteVirtualNumber();
  const [isSheetOpen, setSheetOpen] = React.useState(false);
  const [editedNumber, setEditedNumber] = React.useState<VirtualNumber | null>(
    null,
  );
  const [deletedNumber, setDeletedNumber] =
    React.useState<VirtualNumber | null>(null);
  const virtualNumbers = numbersQuery.data ?? [];
  const serviceNamesBySid = new Map(
    (messagingServicesQuery.data ?? []).map((messagingService) => [
      messagingService.sid,
      messagingService.friendly_name,
    ]),
  );

  const openNumberSheet = (virtualNumber: VirtualNumber | null) => {
    setEditedNumber(virtualNumber);
    setSheetOpen(true);
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Fake numbers your app sends from, with their inbound webhooks.
        </p>
        <Button
          size="sm"
          onClick={() => {
            openNumberSheet(null);
          }}
        >
          <PlusIcon />
          Add number
        </Button>
      </div>
      <div className="min-w-0 rounded-lg border">
        {numbersQuery.isPending && (
          <div className="grid gap-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}
        {numbersQuery.isError && (
          <QueryErrorState
            message="Could not load the numbers."
            onRetry={() => void numbersQuery.refetch()}
          />
        )}
        {numbersQuery.isSuccess && virtualNumbers.length === 0 && (
          <NumbersEmptyState />
        )}
        {virtualNumbers.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead className="hidden sm:table-cell">Channels</TableHead>
                <TableHead className="hidden lg:table-cell">Webhooks</TableHead>
                <TableHead className="hidden md:table-cell">
                  Messaging Service
                </TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {virtualNumbers.map((virtualNumber) => (
                <TableRow key={virtualNumber.id}>
                  <TableCell>
                    <span className="grid">
                      <span className="flex items-center gap-1 font-mono">
                        {virtualNumber.number}
                        <CopyButton
                          copyText={virtualNumber.number}
                          label={`Copy ${virtualNumber.number}`}
                          className="size-6"
                        />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {virtualNumber.label}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className="flex gap-1">
                      {virtualNumber.channels.map((numberChannel) => (
                        <Badge key={numberChannel} variant="secondary">
                          {numberChannelLabels[numberChannel]}
                        </Badge>
                      ))}
                    </span>
                  </TableCell>
                  <TableCell className="hidden max-w-72 lg:table-cell">
                    <WebhookSummary virtualNumber={virtualNumber} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {virtualNumber.messaging_service_sid === null ? (
                      <span className="text-muted-foreground">None</span>
                    ) : (
                      (serviceNamesBySid.get(
                        virtualNumber.messaging_service_sid,
                      ) ?? virtualNumber.messaging_service_sid)
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${virtualNumber.number}`}
                        onClick={() => {
                          openNumberSheet(virtualNumber);
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${virtualNumber.number}`}
                        onClick={() => {
                          setDeletedNumber(virtualNumber);
                        }}
                      >
                        <Trash2Icon />
                      </Button>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <VirtualNumberSheet
        isOpen={isSheetOpen}
        editedNumber={editedNumber}
        registeredNumbers={virtualNumbers
          .filter((virtualNumber) => virtualNumber.id !== editedNumber?.id)
          .map((virtualNumber) => virtualNumber.number)}
        onOpenChange={setSheetOpen}
      />
      <ConfirmDeleteDialog
        itemName={deletedNumber?.number ?? null}
        consequence="Sends from this number still work (any From is accepted), but it loses its inbound webhook, status callback and Messaging Service."
        onConfirm={() => {
          if (deletedNumber === null) {
            return;
          }

          deleteVirtualNumber.mutate(deletedNumber.id, {
            onSuccess: () => {
              toast("Number deleted");
            },
          });
        }}
        onClose={() => {
          setDeletedNumber(null);
        }}
      />
    </div>
  );
}
