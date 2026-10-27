import { PlusIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AddProviderDialog } from "@/features/providers/add-provider-dialog";
import { MessageProviderSheet } from "@/features/providers/message-provider-sheet";
import {
  MessageProvidersTable,
  type ProviderRowAction,
} from "@/features/providers/message-providers-table";
import { providerAreaCopy } from "@/features/providers/provider-area-copy";
import { RemovedProvidersGroup } from "@/features/providers/removed-providers-group";
import { toProviderInput } from "@/features/providers/to-provider-input";
import { usePageTitle } from "@/hooks/use-page-title";
import {
  useDeleteMessageProvider,
  useMessageProviders,
  useResetMessageProvider,
  useRestoreMessageProvider,
  useSaveMessageProvider,
} from "@/lib/api/hooks/use-message-provider-queries";
import type {
  MessageProviderArea,
  MessageProviderDefinition,
} from "@/lib/api/types";

type PendingAction = {
  messageProvider: MessageProviderDefinition;
  rowAction: ProviderRowAction;
};

/** The confirmation for each row action (docs/plan/22, Screens). */
function describeAction({ messageProvider, rowAction }: PendingAction) {
  const name = messageProvider.name;
  if (rowAction === "reset") {
    return {
      title: `Put ${name} back as shipped?`,
      consequence: "Your changes to it are lost.",
      confirmLabel: "Reset to default",
    };
  }
  if (rowAction === "remove") {
    return {
      title: `Remove ${name}?`,
      consequence:
        "Requests to its paths get a 404 until you restore it. Its messages stay.",
      confirmLabel: "Remove",
    };
  }

  return {
    title: `Delete ${name}?`,
    consequence:
      "It stops answering at once. The messages it caught stay, marked deleted provider.",
    confirmLabel: "Delete",
  };
}

/** Mail > Providers and SMS > Providers (EM-18, SM-16). */
export function MessageProvidersPage({
  providerArea,
  initialProviderKey,
}: {
  providerArea: MessageProviderArea;
  /** Opens this provider's sheet first, e.g. from a message's provider badge. */
  initialProviderKey?: string;
}) {
  const areaCopy = providerAreaCopy[providerArea];
  usePageTitle("Providers", areaCopy.menuName);
  const providersQuery = useMessageProviders(providerArea);
  const saveProvider = useSaveMessageProvider(providerArea);
  const resetProvider = useResetMessageProvider(providerArea);
  const restoreProvider = useRestoreMessageProvider(providerArea);
  const deleteProvider = useDeleteMessageProvider(providerArea);
  const [isAddOpen, setAddOpen] = React.useState(false);
  const [pendingAction, setPendingAction] =
    React.useState<PendingAction | null>(null);
  const [editedKey, setEditedKey] = React.useState<string | null>(
    initialProviderKey ?? null,
  );
  const messageProviders = providersQuery.data ?? [];
  const activeProviders = messageProviders.filter(
    (messageProvider) => !messageProvider.is_removed,
  );
  const removedProviders = messageProviders.filter(
    (messageProvider) => messageProvider.is_removed,
  );
  const editedProvider = messageProviders.find(
    (messageProvider) => messageProvider.key === editedKey,
  );

  function runPendingAction(confirmedAction: PendingAction) {
    const { messageProvider, rowAction } = confirmedAction;
    const onSuccess = () => {
      toast(
        rowAction === "reset"
          ? `${messageProvider.name} is back as shipped`
          : `${messageProvider.name} ${rowAction === "remove" ? "removed" : "deleted"}`,
      );
    };
    if (rowAction === "reset") {
      resetProvider.mutate(messageProvider.key, { onSuccess });
      return;
    }
    deleteProvider.mutate(messageProvider.key, { onSuccess });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">{areaCopy.title}</h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              {areaCopy.description}
            </p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <PlusIcon />
            Add provider
          </Button>
        </header>
        <div className="min-w-0 rounded-lg border">
          {providersQuery.isPending ? (
            <Skeleton className="m-4 h-40" />
          ) : providersQuery.isError ? (
            <QueryErrorState
              message="Could not load the providers."
              onRetry={() => void providersQuery.refetch()}
            />
          ) : activeProviders.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Every provider is removed. Restore one below, or add your own.
            </p>
          ) : (
            <MessageProvidersTable
              messageProviders={activeProviders}
              onEdit={(messageProvider) => setEditedKey(messageProvider.key)}
              onToggle={(messageProvider, isEnabled) => {
                saveProvider.mutate(
                  {
                    ...toProviderInput(messageProvider),
                    is_enabled: isEnabled,
                  },
                  {
                    onSuccess: () => {
                      toast(
                        `${messageProvider.name} ${isEnabled ? "enabled" : "disabled"}`,
                      );
                    },
                  },
                );
              }}
              onAction={(messageProvider, rowAction) =>
                setPendingAction({ messageProvider, rowAction })
              }
            />
          )}
        </div>
        <RemovedProvidersGroup
          removedProviders={removedProviders}
          isRestoring={restoreProvider.isPending}
          onRestore={(removedProvider) => {
            restoreProvider.mutate(removedProvider.key, {
              onSuccess: () => toast(`${removedProvider.name} restored`),
            });
          }}
        />
      </div>
      {isAddOpen && (
        <AddProviderDialog
          providerArea={providerArea}
          messageProviders={messageProviders}
          onCreated={(createdProvider) => {
            setAddOpen(false);
            toast(`${createdProvider.name} added`);
            setEditedKey(createdProvider.key);
          }}
          onClose={() => setAddOpen(false)}
        />
      )}
      {editedProvider !== undefined && (
        <MessageProviderSheet
          key={editedProvider.key}
          providerArea={providerArea}
          messageProvider={editedProvider}
          areaProviders={messageProviders}
          onClose={() => setEditedKey(null)}
        />
      )}
      {pendingAction !== null && (
        <ConfirmActionDialog
          isOpen
          {...describeAction(pendingAction)}
          onConfirm={() => {
            runPendingAction(pendingAction);
            setPendingAction(null);
          }}
          onClose={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}
