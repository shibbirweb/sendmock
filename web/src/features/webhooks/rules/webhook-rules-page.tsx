import { useNavigate, useSearch } from "@tanstack/react-router";
import { ListFilterIcon, PlusIcon } from "lucide-react";

import { usePageTitle } from "@/hooks/use-page-title";
import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { NoDataState } from "@/features/onboarding/no-data-state";
import { NoMatchState } from "@/features/onboarding/no-match-state";
import { WebhookRuleSheet } from "@/features/webhooks/rules/editor/webhook-rule-sheet";
import { useWebhookRuleActions } from "@/features/webhooks/rules/use-webhook-rule-actions";
import { WebhookRulesTable } from "@/features/webhooks/rules/webhook-rules-table";
import {
  useWebhookEndpoints,
  useWebhookRules,
} from "@/lib/api/hooks/use-webhook-queries";

/** Select value for "every endpoint" (Select items cannot be empty). */
const allEndpoints = "all";

/** Webhook rules: ordered list, endpoint filter and the rule editor (WH-02). */
export function WebhookRulesPage() {
  usePageTitle("Rules", "Webhooks");
  const { endpoint: endpointFilter } = useSearch({ from: "/webhooks/rules" });
  const navigate = useNavigate({ from: "/webhooks/rules" });
  const rulesQuery = useWebhookRules();
  const endpointsQuery = useWebhookEndpoints();
  const ruleActions = useWebhookRuleActions();
  const webhookEndpoints = endpointsQuery.data ?? [];
  const allRules = rulesQuery.data ?? [];
  const visibleRules = allRules.filter(
    (webhookRule) =>
      endpointFilter === undefined ||
      webhookRule.endpoint_id === endpointFilter,
  );
  const endpointNamesById = new Map(
    webhookEndpoints.map((webhookEndpoint) => [
      webhookEndpoint.id,
      webhookEndpoint.name,
    ]),
  );
  const setEndpointFilter = (endpointId: string | undefined) => {
    void navigate({ search: { endpoint: endpointId } });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">Webhook rules</h2>
            <p className="text-sm text-muted-foreground">
              Which events go to which endpoint, checked from top to bottom.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              ruleActions.openSheet(null);
            }}
          >
            <PlusIcon />
            Add rule
          </Button>
        </header>
        <div className="flex items-center gap-2">
          <ListFilterIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
          <Select
            value={endpointFilter ?? allEndpoints}
            onValueChange={(selectedEndpointId) => {
              setEndpointFilter(
                selectedEndpointId === allEndpoints
                  ? undefined
                  : selectedEndpointId,
              );
            }}
          >
            <SelectTrigger aria-label="Endpoint filter" className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allEndpoints}>Every endpoint</SelectItem>
              {webhookEndpoints.map((webhookEndpoint) => (
                <SelectItem key={webhookEndpoint.id} value={webhookEndpoint.id}>
                  {webhookEndpoint.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 rounded-lg border">
          {rulesQuery.isPending && <Skeleton className="m-4 h-24" />}
          {rulesQuery.isError && (
            <QueryErrorState
              message="Could not load the rules."
              onRetry={() => void rulesQuery.refetch()}
            />
          )}
          {rulesQuery.isSuccess && allRules.length === 0 && (
            <NoDataState
              icon={ListFilterIcon}
              title="No rules yet"
              description="A rule sends chosen events to an endpoint, optionally only when a filter matches."
            >
              <Button
                size="sm"
                onClick={() => {
                  ruleActions.openSheet(null);
                }}
              >
                <PlusIcon />
                Add rule
              </Button>
            </NoDataState>
          )}
          {allRules.length > 0 && visibleRules.length === 0 && (
            <NoMatchState
              message="This endpoint has no rules."
              onClearFilter={() => {
                setEndpointFilter(undefined);
              }}
            />
          )}
          {visibleRules.length > 0 && (
            <WebhookRulesTable
              webhookRules={visibleRules}
              endpointNamesById={endpointNamesById}
              canReorder={endpointFilter === undefined}
              rowActions={{
                onMove: ruleActions.moveRule,
                onToggleEnabled: ruleActions.toggleEnabled,
                onEdit: ruleActions.openSheet,
                onDelete: ruleActions.setDeletedRule,
              }}
            />
          )}
        </div>
      </div>
      <WebhookRuleSheet
        isOpen={ruleActions.isSheetOpen}
        editedRule={ruleActions.editedRule}
        webhookEndpoints={webhookEndpoints}
        defaultEndpointId={endpointFilter ?? webhookEndpoints[0]?.id ?? ""}
        onOpenChange={ruleActions.setSheetOpen}
      />
      <ConfirmDeleteDialog
        itemName={ruleActions.deletedRule?.name ?? null}
        consequence="Its events stop going to the endpoint. Past deliveries stay in the log."
        onConfirm={ruleActions.confirmDelete}
        onClose={() => {
          ruleActions.setDeletedRule(null);
        }}
      />
    </div>
  );
}
