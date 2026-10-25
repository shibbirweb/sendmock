import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { CopyButton } from "@/components/common/copy-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { VerifyServiceDialog } from "@/features/verify/services/verify-service-dialog";
import {
  useDeleteVerifyService,
  useVerifyServices,
} from "@/lib/api/hooks/use-verify-queries";
import type { VerifyService } from "@/lib/api/types";

function formatTtl(ttlSeconds: number): string {
  const ttlMinutes = ttlSeconds / 60;

  return ttlMinutes % 60 === 0 && ttlMinutes >= 60
    ? `${ttlMinutes / 60} h`
    : `${ttlMinutes} min`;
}

function DeleteServiceDialog({
  deletedService,
  onClose,
}: {
  deletedService: VerifyService | null;
  onClose: () => void;
}) {
  const deleteVerifyService = useDeleteVerifyService();

  return (
    <AlertDialog
      open={deletedService !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete {deletedService?.friendly_name}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            Apps using this service SID get Twilio&apos;s 20404 error until they
            switch to another service.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (deletedService === null) {
                return;
              }

              deleteVerifyService.mutate(deletedService.sid, {
                onSuccess: () => {
                  toast("Service deleted");
                },
              });
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Verify services with create, edit and delete (VF-01.3). */
export function VerifyServicesPanel() {
  const servicesQuery = useVerifyServices();
  const [isDialogOpen, setDialogOpen] = React.useState(false);
  const [editedService, setEditedService] =
    React.useState<VerifyService | null>(null);
  const [deletedService, setDeletedService] =
    React.useState<VerifyService | null>(null);

  const openServiceDialog = (verifyService: VerifyService | null) => {
    setEditedService(verifyService);
    setDialogOpen(true);
  };

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Code length, an optional fixed code and how long codes stay valid.
        </p>
        <Button
          size="sm"
          onClick={() => {
            openServiceDialog(null);
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
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">SID</TableHead>
                <TableHead>Code</TableHead>
                <TableHead className="hidden sm:table-cell">
                  Expires after
                </TableHead>
                <TableHead className="w-0">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(servicesQuery.data ?? []).map((verifyService) => (
                <TableRow key={verifyService.sid}>
                  <TableCell className="font-medium">
                    {verifyService.friendly_name}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                      {verifyService.sid}
                      <CopyButton
                        copyText={verifyService.sid}
                        label={`Copy SID of ${verifyService.friendly_name}`}
                        className="size-6"
                      />
                    </span>
                  </TableCell>
                  <TableCell>
                    {verifyService.code_length} digits,{" "}
                    {verifyService.fixed_code === null ? (
                      "random"
                    ) : (
                      <span className="font-mono">
                        fixed {verifyService.fixed_code}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {formatTtl(verifyService.ttl_seconds)}
                  </TableCell>
                  <TableCell>
                    <span className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${verifyService.friendly_name}`}
                        onClick={() => {
                          openServiceDialog(verifyService);
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${verifyService.friendly_name}`}
                        onClick={() => {
                          setDeletedService(verifyService);
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
      <VerifyServiceDialog
        isOpen={isDialogOpen}
        editedService={editedService}
        onOpenChange={setDialogOpen}
      />
      <DeleteServiceDialog
        deletedService={deletedService}
        onClose={() => {
          setDeletedService(null);
        }}
      />
    </div>
  );
}
