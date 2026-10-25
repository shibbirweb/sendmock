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
import { MessagingServiceSheet } from "@/features/numbers/messaging-services/messaging-service-sheet";
import { inboundModeLabels } from "@/features/numbers/numbers-labels";
import {
  useDeleteMessagingService,
  useMessagingServices,
  useVirtualNumbers,
} from "@/lib/api/hooks/use-numbers-queries";
import type { MessagingService } from "@/lib/api/types";

/** Twilio-style Messaging Services: sender pools and inbound handling (SM-03). */
export function MessagingServicesPanel() {
  const servicesQuery = useMessagingServices();
  const numbersQuery = useVirtualNumbers();
  const deleteMessagingService = useDeleteMessagingService();
  const [isSheetOpen, setSheetOpen] = React.useState(false);
  const [editedService, setEditedService] =
    React.useState<MessagingService | null>(null);
  const [deletedService, setDeletedService] =
    React.useState<MessagingService | null>(null);
  const messagingServices = servicesQuery.data ?? [];
  const phoneNumbersById = new Map(
    (numbersQuery.data ?? []).map((virtualNumber) => [
      virtualNumber.id,
      virtualNumber.number,
    ]),
  );

  const openServiceSheet = (messagingService: MessagingService | null) => {
    setEditedService(messagingService);
    setSheetOpen(true);
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Sender pools for sends with MessagingServiceSid.
        </p>
        <Button
          size="sm"
          onClick={() => {
            openServiceSheet(null);
          }}
        >
          <PlusIcon />
          New service
        </Button>
      </div>
      <div className="min-w-0 rounded-lg border">
        {servicesQuery.isPending ? (
          <div className="grid gap-2 p-4">
            <Skeleton className="h-8 w-full" />
          </div>
        ) : servicesQuery.isError ? (
          <QueryErrorState
            message="Could not load the Messaging Services."
            onRetry={() => void servicesQuery.refetch()}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Senders</TableHead>
                <TableHead className="hidden md:table-cell">
                  Inbound messages
                </TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messagingServices.map((messagingService) => (
                <TableRow key={messagingService.sid}>
                  <TableCell>
                    <span className="grid">
                      <span className="font-medium">
                        {messagingService.friendly_name}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                        {messagingService.sid}
                        <CopyButton
                          copyText={messagingService.sid}
                          label={`Copy SID of ${messagingService.friendly_name}`}
                          className="size-6"
                        />
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {messagingService.number_ids.length === 0 ? (
                      <span className="text-muted-foreground">
                        Generated number
                      </span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {messagingService.number_ids.map((numberId) => (
                          <Badge
                            key={numberId}
                            variant="secondary"
                            className="font-mono"
                          >
                            {phoneNumbersById.get(numberId) ?? numberId}
                          </Badge>
                        ))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden max-w-72 md:table-cell">
                    <span className="grid min-w-0">
                      <span>
                        {inboundModeLabels[messagingService.inbound_mode]}
                      </span>
                      {messagingService.inbound_url !== null && (
                        <span
                          className="truncate text-xs text-muted-foreground"
                          title={messagingService.inbound_url}
                        >
                          {messagingService.inbound_url}
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${messagingService.friendly_name}`}
                        onClick={() => {
                          openServiceSheet(messagingService);
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${messagingService.friendly_name}`}
                        onClick={() => {
                          setDeletedService(messagingService);
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
      <MessagingServiceSheet
        isOpen={isSheetOpen}
        editedService={editedService}
        messagingServices={messagingServices}
        onOpenChange={setSheetOpen}
      />
      <ConfirmDeleteDialog
        itemName={deletedService?.friendly_name ?? null}
        consequence="Its numbers stay registered but leave the pool. Sends with this MessagingServiceSid get a new service in lenient mode or error 21701 in strict mode."
        onConfirm={() => {
          if (deletedService === null) {
            return;
          }

          deleteMessagingService.mutate(deletedService.sid, {
            onSuccess: () => {
              toast("Service deleted");
            },
          });
        }}
        onClose={() => {
          setDeletedService(null);
        }}
      />
    </div>
  );
}
