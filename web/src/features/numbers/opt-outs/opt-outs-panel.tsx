import { Undo2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { IconButton } from "@/components/common/icon-button";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useLiftAllSmsOptOuts,
  useLiftSmsOptOut,
  useSmsOptOuts,
} from "@/lib/api/hooks/use-opt-out-queries";
import { formatDateTime } from "@/lib/format/format-values";

/** Contacts who texted STOP, and lifting their opt-outs (SM-23.3). */
export function OptOutsPanel() {
  const optOutsQuery = useSmsOptOuts();
  const liftOptOut = useLiftSmsOptOut();
  const liftAllOptOuts = useLiftAllSmsOptOuts();
  const [isLiftAllOpen, setLiftAllOpen] = React.useState(false);
  const optOuts = optOutsQuery.data ?? [];

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Contacts who texted STOP. Sends to them from that number or Messaging
          Service get error 21610 until they text START.
        </p>
        <Button
          size="sm"
          variant="outline"
          disabled={optOuts.length === 0}
          onClick={() => {
            setLiftAllOpen(true);
          }}
        >
          Lift all
        </Button>
      </div>
      <div className="min-w-0 rounded-lg border">
        {optOutsQuery.isPending ? (
          <div className="grid gap-2 p-4">
            <Skeleton className="h-8 w-full" />
          </div>
        ) : optOutsQuery.isError ? (
          <QueryErrorState
            message="Could not load the opt-outs."
            onRetry={() => void optOutsQuery.refetch()}
          />
        ) : optOuts.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No opt-outs. A contact who texts STOP to one of your numbers is
            listed here.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead className="hidden sm:table-cell">Keyword</TableHead>
                <TableHead className="hidden md:table-cell">When</TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {optOuts.map((optOut) => (
                <TableRow key={`${optOut.sender} ${optOut.contact_number}`}>
                  <TableCell className="font-mono">
                    {optOut.contact_number}
                  </TableCell>
                  <TableCell className="font-mono">{optOut.sender}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {optOut.keyword}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {formatDateTime(optOut.created_at)}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      variant="ghost"
                      size="icon-sm"
                      label={`Lift the opt-out of ${optOut.contact_number}`}
                      onClick={() => {
                        liftOptOut.mutate(optOut, {
                          onSuccess: () => {
                            toast("Opt-out lifted");
                          },
                        });
                      }}
                    >
                      <Undo2Icon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
      <ConfirmActionDialog
        isOpen={isLiftAllOpen}
        title="Lift every opt-out?"
        consequence="Your app can send to these contacts again, as if each texted START."
        confirmLabel="Lift all"
        onConfirm={() => {
          liftAllOptOuts.mutate(undefined, {
            onSuccess: () => {
              toast("Every opt-out lifted");
            },
          });
        }}
        onClose={() => {
          setLiftAllOpen(false);
        }}
      />
    </div>
  );
}
