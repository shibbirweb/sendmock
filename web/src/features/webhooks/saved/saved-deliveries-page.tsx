import { BookmarkIcon, SearchIcon } from "lucide-react";
import * as React from "react";

import { usePageTitle } from "@/hooks/use-page-title";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { NamePromptDialog } from "@/components/common/name-prompt-dialog";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { NoDataState } from "@/features/onboarding/no-data-state";
import { NoMatchState } from "@/features/onboarding/no-match-state";
import { SavedDeliveryItem } from "@/features/webhooks/saved/saved-delivery-item";
import { SendSavedDialog } from "@/features/webhooks/saved/send-saved-dialog";
import { useSavedDeliveryActions } from "@/features/webhooks/saved/use-saved-delivery-actions";
import {
  useSavedDeliveries,
  useWebhookEndpoints,
  useWebhookTemplates,
} from "@/lib/api/hooks/use-webhook-queries";

/** Saved deliveries: search, stored requests, send again, rename, template, delete (WH-10). */
export function SavedDeliveriesPage() {
  usePageTitle("Saved deliveries", "Webhooks");
  const savedQuery = useSavedDeliveries();
  const endpointsQuery = useWebhookEndpoints();
  const templatesQuery = useWebhookTemplates();
  const savedActions = useSavedDeliveryActions();
  const [nameSearch, setNameSearch] = React.useState("");
  const webhookEndpoints = endpointsQuery.data ?? [];
  const allSaved = savedQuery.data ?? [];
  const visibleSaved = allSaved.filter((savedDelivery) =>
    savedDelivery.name.toLowerCase().includes(nameSearch.trim().toLowerCase()),
  );
  const endpointNamesById = new Map(
    webhookEndpoints.map((webhookEndpoint) => [
      webhookEndpoint.id,
      webhookEndpoint.name,
    ]),
  );
  const templateNamesById = new Map(
    (templatesQuery.data ?? []).map((webhookTemplate) => [
      webhookTemplate.id,
      webhookTemplate.name,
    ]),
  );
  const { openAction } = savedActions;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-5xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="grid gap-1">
          <h2 className="text-xl font-semibold">Saved deliveries</h2>
          <p className="text-sm text-muted-foreground">
            Requests you bookmarked, kept through pruning and reset, ready to
            send again.
          </p>
        </header>
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={nameSearch}
            placeholder="Search by name"
            aria-label="Search saved deliveries"
            className="pl-8"
            onChange={(changeEvent) => {
              setNameSearch(changeEvent.target.value);
            }}
          />
        </div>
        {savedQuery.isPending && <Skeleton className="h-32 w-full" />}
        {savedQuery.isError && (
          <QueryErrorState
            message="Could not load the saved deliveries."
            onRetry={() => void savedQuery.refetch()}
            className="rounded-lg border"
          />
        )}
        {savedQuery.isSuccess && allSaved.length === 0 && (
          <NoDataState
            icon={BookmarkIcon}
            title="Nothing saved yet"
            description='Open a delivery in Deliveries and press "Save" to keep it here.'
            className="rounded-lg border"
          />
        )}
        {allSaved.length > 0 && visibleSaved.length === 0 && (
          <NoMatchState
            message="No saved delivery has that name."
            clearLabel="Clear search"
            onClearFilter={() => {
              setNameSearch("");
            }}
            className="rounded-lg border"
          />
        )}
        <ul aria-label="Saved deliveries" className="grid gap-3">
          {visibleSaved.map((savedDelivery) => (
            <SavedDeliveryItem
              key={savedDelivery.id}
              savedDelivery={savedDelivery}
              endpointName={
                savedDelivery.endpoint_id === null
                  ? null
                  : (endpointNamesById.get(savedDelivery.endpoint_id) ??
                    "a deleted endpoint")
              }
              templateName={
                templateNamesById.get(savedDelivery.template_id) ??
                savedDelivery.template_id
              }
              onAction={(savedAction) => {
                savedActions.openSavedAction(savedDelivery, savedAction);
              }}
            />
          ))}
        </ul>
      </div>
      {openAction?.savedAction === "send" && (
        <SendSavedDialog
          savedDelivery={openAction.savedDelivery}
          webhookEndpoints={webhookEndpoints}
          onClose={savedActions.closeAction}
        />
      )}
      {openAction?.savedAction === "rename" && (
        <NamePromptDialog
          title="Rename saved delivery"
          description="The new name shows here and in the seed export."
          confirmLabel="Rename"
          initialName={openAction.savedDelivery.name}
          isSubmitting={savedActions.isRenaming}
          onSubmit={(savedName) => {
            savedActions.rename(openAction.savedDelivery, savedName);
          }}
          onClose={savedActions.closeAction}
        />
      )}
      {openAction?.savedAction === "template" && (
        <NamePromptDialog
          title="Save as template"
          description="The stored request becomes a custom template you can pick for any endpoint."
          confirmLabel="Save template"
          initialName={openAction.savedDelivery.name}
          isSubmitting={savedActions.isSavingTemplate}
          onSubmit={(templateName) => {
            savedActions.saveTemplate(openAction.savedDelivery, templateName);
          }}
          onClose={savedActions.closeAction}
        />
      )}
      <ConfirmDeleteDialog
        itemName={
          openAction?.savedAction === "delete"
            ? openAction.savedDelivery.name
            : null
        }
        consequence="The bookmark goes; past deliveries stay in the log."
        onConfirm={() => {
          if (openAction?.savedAction === "delete") {
            savedActions.remove(openAction.savedDelivery);
          }
        }}
        onClose={savedActions.closeAction}
      />
    </div>
  );
}
