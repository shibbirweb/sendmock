import { MailPlusIcon, PlusIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InboundRouteSheet } from "@/features/webhooks/inbound-routes/inbound-route-sheet";
import { InboundRoutesTable } from "@/features/webhooks/inbound-routes/inbound-routes-table";
import {
  useDeleteInboundRoute,
  useInboundRoutes,
  useMoveInboundRoute,
} from "@/lib/api/hooks/use-inbound-route-queries";
import type { InboundRoute } from "@/lib/api/types";

/** Webhooks > Inbound routes: Mailgun-style routes for incoming emails (WH-12.7). */
export function InboundRoutesPage() {
  const routesQuery = useInboundRoutes();
  const moveRoute = useMoveInboundRoute();
  const deleteRoute = useDeleteInboundRoute();
  const [editedRoute, setEditedRoute] = React.useState<
    InboundRoute | null | undefined
  >(undefined);
  const [deletedRoute, setDeletedRoute] = React.useState<InboundRoute | null>(
    null,
  );
  const inboundRoutes = routesQuery.data ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">Inbound routes</h2>
            <p className="text-sm text-muted-foreground">
              What happens to incoming emails, such as replies to mail your app
              sent: matching routes run in priority order until one stops, like
              Mailgun Routes.
            </p>
          </div>
          <Button size="sm" onClick={() => setEditedRoute(null)}>
            <PlusIcon />
            Add route
          </Button>
        </header>
        <div className="min-w-0 rounded-lg border">
          {routesQuery.isPending ? (
            <Skeleton className="m-4 h-40" />
          ) : inboundRoutes.length === 0 ? (
            <div className="grid justify-items-center gap-2 p-10 text-center">
              <MailPlusIcon className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No routes yet. Add one to forward replies to your app.
              </p>
            </div>
          ) : (
            <InboundRoutesTable
              inboundRoutes={inboundRoutes}
              onMove={(routeIndex, isMovingUp) => {
                const movedRoute = inboundRoutes[routeIndex];
                const neighbourRoute =
                  inboundRoutes[routeIndex + (isMovingUp ? -1 : 1)];
                if (movedRoute !== undefined && neighbourRoute !== undefined) {
                  moveRoute.mutate({ movedRoute, neighbourRoute, isMovingUp });
                }
              }}
              onEdit={setEditedRoute}
              onDelete={setDeletedRoute}
            />
          )}
        </div>
      </div>
      {editedRoute !== undefined && (
        <InboundRouteSheet
          key={editedRoute?.id ?? "new"}
          inboundRoute={editedRoute}
          onClose={() => setEditedRoute(undefined)}
        />
      )}
      <ConfirmDeleteDialog
        itemName={
          deletedRoute === null
            ? null
            : deletedRoute.description || deletedRoute.expression
        }
        consequence="Incoming emails no longer run this route."
        onConfirm={() => {
          if (deletedRoute !== null) {
            deleteRoute.mutate(deletedRoute.id, {
              onSuccess: () => toast("Route deleted"),
            });
          }
        }}
        onClose={() => setDeletedRoute(null)}
      />
    </div>
  );
}
