import { useNavigate, useSearch } from "@tanstack/react-router";
import { PlusIcon, SendIcon } from "lucide-react";
import * as React from "react";

import { ConfirmDeleteDialog } from "@/components/common/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NoDataState } from "@/features/onboarding/no-data-state";
import { EndpointTestDialog } from "@/features/webhooks/endpoints/endpoint-test-dialog";
import { WebhookEndpointSheet } from "@/features/webhooks/endpoints/sheet/webhook-endpoint-sheet";
import { useWebhookEndpointActions } from "@/features/webhooks/endpoints/use-webhook-endpoint-actions";
import { WebhookEndpointsTable } from "@/features/webhooks/endpoints/webhook-endpoints-table";
import { useAppInfo } from "@/lib/api/hooks/use-system-queries";
import {
  useWebhookEndpoints,
  useWebhookRules,
  useWebhookTemplates,
} from "@/lib/api/hooks/use-webhook-queries";
import type { WebhookEndpointInput } from "@/lib/api/types";
import { readPort } from "@/lib/settings/build-connection-snippets";

/** Native JSON to SendMock's own catcher, so a test lands in HTTP. */
function buildCatcherEndpointInput(httpPort: number): WebhookEndpointInput {
  return {
    name: "HTTP catcher",
    url: `http://127.0.0.1:${httpPort}/catch/webhooks`,
    method: "POST",
    headers: {},
    extra_fields: {},
    template_id: "native",
    template_mode: "linked",
    timeout_ms: 10_000,
    retry_policy: {
      max_attempts: 5,
      backoff_seconds: [1, 5, 30, 120, 600],
      retry_on_client_errors: false,
    },
    is_enabled: true,
  };
}

/** Webhook endpoints: table, edit sheet, Send test and delete (WH-01). */
export function WebhookEndpointsPage() {
  const endpointsQuery = useWebhookEndpoints();
  const rulesQuery = useWebhookRules();
  const templatesQuery = useWebhookTemplates();
  const appInfoQuery = useAppInfo();
  const endpointActions = useWebhookEndpointActions();
  const { template: templateToUse } = useSearch({
    from: "/webhooks/endpoints",
  });
  const navigate = useNavigate({ from: "/webhooks/endpoints" });
  const { openNewEndpointWithTemplate } = endpointActions;

  React.useEffect(() => {
    if (templateToUse === undefined) {
      return;
    }

    openNewEndpointWithTemplate(templateToUse);
    void navigate({ search: {}, replace: true });
  }, [templateToUse, openNewEndpointWithTemplate, navigate]);
  const webhookEndpoints = endpointsQuery.data ?? [];
  const templateNamesById = new Map(
    (templatesQuery.data ?? []).map((webhookTemplate) => [
      webhookTemplate.id,
      webhookTemplate.name,
    ]),
  );
  const editedEndpoint =
    webhookEndpoints.find(
      (webhookEndpoint) =>
        webhookEndpoint.id === endpointActions.editedEndpointId,
    ) ?? null;
  const deletedRuleCount = (rulesQuery.data ?? []).filter(
    (webhookRule) =>
      webhookRule.endpoint_id === endpointActions.deletedEndpoint?.id,
  ).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">Webhook endpoints</h2>
            <p className="text-sm text-muted-foreground">
              Where SendMock sends webhooks: URL, template, secret and retry
              policy.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => {
              endpointActions.openSheet(null);
            }}
          >
            <PlusIcon />
            Add endpoint
          </Button>
        </header>
        <div className="min-w-0 rounded-lg border">
          {endpointsQuery.isPending && <Skeleton className="m-4 h-24" />}
          {endpointsQuery.isError && (
            <div className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-sm text-destructive">
                Could not load the endpoints.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void endpointsQuery.refetch()}
              >
                Try again
              </Button>
            </div>
          )}
          {endpointsQuery.isSuccess && webhookEndpoints.length === 0 && (
            <NoDataState
              icon={SendIcon}
              title="No endpoints yet"
              description="Add the URL of your app's webhook handler, or start with one that points at SendMock's own HTTP catcher."
            >
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  endpointActions.createEndpoint({
                    endpointId: null,
                    endpointInput: buildCatcherEndpointInput(
                      readPort(appInfoQuery.data?.http_address ?? null, 8025),
                    ),
                  });
                }}
              >
                Add a catcher endpoint
              </Button>
            </NoDataState>
          )}
          {webhookEndpoints.length > 0 && (
            <WebhookEndpointsTable
              webhookEndpoints={webhookEndpoints}
              templateNamesById={templateNamesById}
              rowActions={{
                onToggleEnabled: endpointActions.toggleEnabled,
                onSendTest: endpointActions.sendTest,
                onEdit: endpointActions.openSheet,
                onDelete: endpointActions.setDeletedEndpoint,
              }}
            />
          )}
        </div>
      </div>
      <WebhookEndpointSheet
        isOpen={endpointActions.isSheetOpen}
        editedEndpoint={editedEndpoint}
        initialTemplateId={endpointActions.newEndpointTemplateId}
        onOpenChange={endpointActions.setSheetOpen}
        onCreated={(createdEndpoint) => {
          endpointActions.setEditedEndpointId(createdEndpoint.id);
        }}
        onSendTest={endpointActions.sendTest}
      />
      <ConfirmDeleteDialog
        itemName={endpointActions.deletedEndpoint?.name ?? null}
        consequence={
          deletedRuleCount === 0
            ? "Its variables go with it. Past deliveries stay in the log."
            : `Its ${deletedRuleCount} rule${deletedRuleCount === 1 ? "" : "s"} and its variables go with it. Past deliveries stay in the log.`
        }
        onConfirm={endpointActions.confirmDelete}
        onClose={() => {
          endpointActions.setDeletedEndpoint(null);
        }}
      />
      <EndpointTestDialog
        endpointName={endpointActions.testedEndpointName}
        testDelivery={endpointActions.testDelivery}
        isSending={endpointActions.isTestSending}
        onClose={endpointActions.closeTestDialog}
      />
    </div>
  );
}
