import { useNavigate, useSearch } from "@tanstack/react-router";
import { Trash2Icon } from "lucide-react";
import * as React from "react";

import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { HttpBodyView } from "@/components/common/http-body-view";
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
import { pushProviderLabels } from "@/features/push/push-labels";
import { PushPhonePreview } from "@/features/push/push-phone-preview";
import { PushStatusBadge } from "@/features/push/push-status-badge";
import {
  useDeletePushNotification,
  usePushNotification,
} from "@/lib/api/hooks/use-push-queries";
import type { PushNotification } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format/format-values";

function PushFact({
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

function PushDataRows({ pushData }: { pushData: Record<string, unknown> }) {
  const dataEntries = Object.entries(pushData);
  if (dataEntries.length === 0) {
    return <p className="text-xs text-muted-foreground">No data payload</p>;
  }

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border bg-muted/30 p-3 font-mono text-xs">
      {dataEntries.map(([dataKey, dataValue]) => (
        <PushFact key={dataKey} label={dataKey}>
          {typeof dataValue === "string"
            ? dataValue
            : JSON.stringify(dataValue)}
        </PushFact>
      ))}
    </dl>
  );
}

function PushDrawerBody({
  pushNotification,
  onDeleted,
}: {
  pushNotification: PushNotification;
  onDeleted: () => void;
}) {
  const deletePush = useDeletePushNotification();
  const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);

  return (
    <div className="grid gap-4 px-4 pb-6">
      <PushPhonePreview
        key={pushNotification.id}
        pushNotification={pushNotification}
      />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <PushFact label="Status">
          <PushStatusBadge pushStatus={pushNotification.status} />
        </PushFact>
        {pushNotification.error_reason !== null && (
          <PushFact label="Reason">{pushNotification.error_reason}</PushFact>
        )}
        <PushFact label="Provider">
          {pushProviderLabels[pushNotification.provider]}
        </PushFact>
        <PushFact label="Device token">
          <span className="font-mono text-xs">
            {pushNotification.device_token}
          </span>
        </PushFact>
        <PushFact label="Message id">
          <span className="font-mono text-xs">
            {pushNotification.provider_message_id}
          </span>
        </PushFact>
        <PushFact label="Project">{pushNotification.project}</PushFact>
        <PushFact label="Sent">
          {formatDateTime(pushNotification.created_at)}
        </PushFact>
      </dl>
      <section aria-label="Data" className="grid gap-1.5">
        <h4 className="text-xs font-medium text-muted-foreground">Data</h4>
        <PushDataRows pushData={pushNotification.data} />
      </section>
      <Separator />
      <HttpBodyView
        title="Request"
        bodyText={JSON.stringify(pushNotification.request)}
        contentType="application/json"
      />
      <HttpBodyView
        title={`Answer (${pushNotification.response_status})`}
        bodyText={JSON.stringify(pushNotification.response)}
        contentType="application/json"
      />
      <div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsConfirmingDelete(true);
          }}
        >
          <Trash2Icon />
          Delete
        </Button>
      </div>
      <ConfirmDeleteDialog
        itemName={isConfirmingDelete ? "this notification" : null}
        consequence="Your tests can no longer wait for or read it."
        onConfirm={() => {
          deletePush.mutate(pushNotification.id, { onSuccess: onDeleted });
        }}
        onClose={() => {
          setIsConfirmingDelete(false);
        }}
      />
    </div>
  );
}

function PushDrawerContent({
  pushId,
  onDeleted,
}: {
  pushId: string;
  onDeleted: () => void;
}) {
  const pushQuery = usePushNotification(pushId);

  if (pushQuery.isPending) {
    return (
      <div className="grid gap-3 px-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (pushQuery.isError) {
    return (
      <p className="px-4 text-sm text-destructive">
        Could not load this notification. It may have been deleted.
      </p>
    );
  }

  return (
    <PushDrawerBody pushNotification={pushQuery.data} onDeleted={onDeleted} />
  );
}

/** One notification, open while `?push=` is set. */
export function PushDrawer() {
  const { push: openPushId } = useSearch({ from: "/push" });
  const navigate = useNavigate({ from: "/push" });
  const closeDrawer = () => {
    void navigate({
      search: (previousSearch) => ({ ...previousSearch, push: undefined }),
    });
  };

  return (
    <Sheet
      open={openPushId !== undefined}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          closeDrawer();
        }
      }}
    >
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Push notification</SheetTitle>
          <SheetDescription>
            As the phone shows it, with its data, the request and the answer.
          </SheetDescription>
        </SheetHeader>
        {openPushId !== undefined && (
          <PushDrawerContent pushId={openPushId} onDeleted={closeDrawer} />
        )}
      </SheetContent>
    </Sheet>
  );
}
