import { useNavigate, useSearch } from "@tanstack/react-router";
import { PlusIcon, VariableIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { usePageTitle } from "@/hooks/use-page-title";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NoDataState } from "@/features/onboarding/no-data-state";
import { NoMatchState } from "@/features/onboarding/no-match-state";
import { globalScopeValue } from "@/features/webhooks/variables/sheet/use-variable-form";
import { VariableSheet } from "@/features/webhooks/variables/sheet/variable-sheet";
import {
  anyScope,
  globalScope,
  VariableFilters,
} from "@/features/webhooks/variables/variable-filters";
import { VariablesTable } from "@/features/webhooks/variables/variables-table";
import { useDeleteWebhookVariable } from "@/lib/api/hooks/use-webhook-endpoint-queries";
import {
  useWebhookEndpoints,
  useWebhookVariables,
} from "@/lib/api/hooks/use-webhook-queries";
import { useRegenerateVariable } from "@/lib/api/hooks/use-webhook-variable-queries";
import type { VariableKind, WebhookVariable } from "@/lib/api/types";

function matchesScope(
  webhookVariable: WebhookVariable,
  scopeFilter: string,
): boolean {
  if (scopeFilter === anyScope) {
    return true;
  }
  if (scopeFilter === globalScope) {
    return webhookVariable.scope === "global";
  }

  return webhookVariable.endpoint_id === scopeFilter;
}

/** Webhook variables of every kind: table, filters and the edit sheet (WH-07.11 to WH-07.13). */
export function VariablesPage() {
  usePageTitle("Variables", "Webhooks");
  const { endpoint: scopeFromUrl } = useSearch({ from: "/webhooks/variables" });
  const navigate = useNavigate({ from: "/webhooks/variables" });
  const variablesQuery = useWebhookVariables();
  const endpointsQuery = useWebhookEndpoints();
  const deleteWebhookVariable = useDeleteWebhookVariable();
  const regenerateVariable = useRegenerateVariable();
  const [kindFilter, setKindFilter] = React.useState<VariableKind | null>(null);
  const [nameSearch, setNameSearch] = React.useState("");
  const [isSheetOpen, setSheetOpen] = React.useState(false);
  const [editedVariable, setEditedVariable] =
    React.useState<WebhookVariable | null>(null);
  const [deletedVariable, setDeletedVariable] =
    React.useState<WebhookVariable | null>(null);
  const scopeFilter = scopeFromUrl ?? anyScope;
  const allVariables = variablesQuery.data ?? [];
  const webhookEndpoints = endpointsQuery.data ?? [];
  const visibleVariables = allVariables.filter(
    (webhookVariable) =>
      matchesScope(webhookVariable, scopeFilter) &&
      (kindFilter === null || webhookVariable.kind === kindFilter) &&
      webhookVariable.name.includes(nameSearch.trim().toLowerCase()),
  );
  const endpointNamesById = new Map(
    webhookEndpoints.map((webhookEndpoint) => [
      webhookEndpoint.id,
      webhookEndpoint.name,
    ]),
  );
  const openSheet = (webhookVariable: WebhookVariable | null) => {
    setEditedVariable(webhookVariable);
    setSheetOpen(true);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">Webhook variables</h2>
            <p className="text-sm text-muted-foreground">
              Values templates read as {"{{ vars.name }}"}: endpoint ones win
              over global ones.
            </p>
          </div>
          <Button size="sm" onClick={() => openSheet(null)}>
            <PlusIcon />
            Add variable
          </Button>
        </header>
        <VariableFilters
          scopeFilter={scopeFilter}
          kindFilter={kindFilter}
          nameSearch={nameSearch}
          webhookEndpoints={webhookEndpoints}
          onScopeChange={(nextScope) => {
            void navigate({
              search: {
                endpoint: nextScope === anyScope ? undefined : nextScope,
              },
            });
          }}
          onKindChange={setKindFilter}
          onNameSearchChange={setNameSearch}
        />
        <div className="min-w-0 rounded-lg border">
          {variablesQuery.isPending && <Skeleton className="m-4 h-24" />}
          {variablesQuery.isError && (
            <QueryErrorState
              message="Could not load the variables."
              onRetry={() => void variablesQuery.refetch()}
            />
          )}
          {variablesQuery.isSuccess && allVariables.length === 0 && (
            <NoDataState
              icon={VariableIcon}
              title="No variables yet"
              description="Keep tokens, tenant ids and generated values in one place and use them in any template."
            />
          )}
          {allVariables.length > 0 && visibleVariables.length === 0 && (
            <NoMatchState
              message="No variable matches these filters."
              onClearFilter={() => {
                setKindFilter(null);
                setNameSearch("");
                void navigate({ search: {} });
              }}
            />
          )}
          {visibleVariables.length > 0 && (
            <VariablesTable
              webhookVariables={visibleVariables}
              endpointNamesById={endpointNamesById}
              rowActions={{
                onEdit: openSheet,
                onDelete: setDeletedVariable,
                onRegenerate: (webhookVariable) => {
                  regenerateVariable.mutate(webhookVariable.id, {
                    onSuccess: (regeneratedVariable) => {
                      toast("Regenerated", {
                        description: regeneratedVariable.fixed_value ?? "",
                      });
                    },
                  });
                },
              }}
            />
          )}
        </div>
      </div>
      <VariableSheet
        isOpen={isSheetOpen}
        editedVariable={editedVariable}
        defaultScopeValue={
          scopeFilter === anyScope || scopeFilter === globalScope
            ? globalScopeValue
            : scopeFilter
        }
        allVariables={allVariables}
        webhookEndpoints={webhookEndpoints}
        onOpenChange={setSheetOpen}
      />
      <ConfirmDeleteDialog
        itemName={
          deletedVariable === null ? null : `vars.${deletedVariable.name}`
        }
        consequence="Templates that use it render it empty, with a warning."
        onConfirm={() => {
          if (deletedVariable !== null) {
            deleteWebhookVariable.mutate(deletedVariable.id, {
              onSuccess: () => {
                toast("Variable deleted");
              },
            });
          }
        }}
        onClose={() => {
          setDeletedVariable(null);
        }}
      />
    </div>
  );
}
