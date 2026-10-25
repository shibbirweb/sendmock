import { useNavigate, useSearch } from "@tanstack/react-router";
import { FileCodeIcon, PlusIcon, UploadIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { usePageTitle } from "@/hooks/use-page-title";
import { NamePromptDialog } from "@/components/common/name-prompt-dialog";
import { QueryErrorState } from "@/components/common/query-error-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NoMatchState } from "@/features/onboarding/no-match-state";
import { ImportTemplateDialog } from "@/features/webhooks/templates/import-template-dialog";
import {
  TemplatesFilterBar,
  type TemplateFilterChange,
} from "@/features/webhooks/templates/templates-filter-bar";
import { TemplateCard } from "@/features/webhooks/templates/template-card";
import { TemplateDrawer } from "@/features/webhooks/templates/detail/template-drawer";
import { useWebhookTemplates } from "@/lib/api/hooks/use-webhook-queries";
import { useCreateTemplate } from "@/lib/api/hooks/use-webhook-template-queries";

/** Templates gallery: category tabs, search and event filter in the URL (WH-08.3). */
export function TemplatesPage() {
  usePageTitle("Templates", "Webhooks");
  const { category, query, event } = useSearch({ from: "/webhooks/templates" });
  const navigate = useNavigate({ from: "/webhooks/templates" });
  const templatesQuery = useWebhookTemplates();
  const createTemplate = useCreateTemplate();
  const [openDialog, setOpenDialog] = React.useState<"new" | "import" | null>(
    null,
  );
  const openTemplate = (templateId: string, shouldEdit: boolean) => {
    void navigate({
      search: (previousSearch) => ({
        ...previousSearch,
        template: templateId,
        edit: shouldEdit ? true : undefined,
      }),
    });
  };
  const searchText = (query ?? "").trim().toLowerCase();
  const visibleTemplates = (templatesQuery.data ?? []).filter(
    (webhookTemplate) =>
      (category === undefined || webhookTemplate.category === category) &&
      (event === undefined ||
        webhookTemplate.events.some((eventType) => eventType === event)) &&
      (searchText === "" ||
        `${webhookTemplate.name} ${webhookTemplate.service}`
          .toLowerCase()
          .includes(searchText)),
  );
  const hasFilters =
    category !== undefined || event !== undefined || searchText !== "";
  const updateSearch = (changedSearch: TemplateFilterChange) => {
    void navigate({
      search: (previousSearch) => ({ ...previousSearch, ...changedSearch }),
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">Webhook templates</h2>
            <p className="text-sm text-muted-foreground">
              Payload formats your endpoints can send: SendMock's own JSON,
              providers your app already parses, chat tools, and your own.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setOpenDialog("import");
              }}
            >
              <UploadIcon />
              Import
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setOpenDialog("new");
              }}
            >
              <PlusIcon />
              New template
            </Button>
          </div>
        </header>
        <TemplatesFilterBar
          category={category}
          query={query}
          event={event}
          onChange={updateSearch}
        />
        {templatesQuery.isPending && <Skeleton className="h-48 w-full" />}
        {templatesQuery.isError && (
          <QueryErrorState
            message="Could not load the templates."
            onRetry={() => void templatesQuery.refetch()}
            className="rounded-lg border"
          />
        )}
        {templatesQuery.isSuccess &&
          visibleTemplates.length === 0 &&
          hasFilters && (
            <NoMatchState
              message="No template matches these filters."
              onClearFilter={() => {
                void navigate({ search: {} });
              }}
              className="rounded-lg border"
            />
          )}
        {visibleTemplates.length === 0 &&
          !hasFilters &&
          templatesQuery.isSuccess && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileCodeIcon aria-hidden="true" className="size-4" />
              No templates.
            </p>
          )}
        <ul
          aria-label="Templates"
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {visibleTemplates.map((webhookTemplate) => (
            <TemplateCard
              key={webhookTemplate.id}
              webhookTemplate={webhookTemplate}
            />
          ))}
        </ul>
      </div>
      <TemplateDrawer />
      {openDialog === "new" && (
        <NamePromptDialog
          title="New template"
          description="It starts as SendMock's native JSON; change it in the editor that opens next."
          confirmLabel="Create"
          initialName=""
          isSubmitting={createTemplate.isPending}
          onSubmit={(templateName) => {
            createTemplate.mutate(templateName, {
              onSuccess: (createdTemplate) => {
                setOpenDialog(null);
                openTemplate(createdTemplate.id, true);
              },
              onError: () => {
                toast.error("Could not create the template");
              },
            });
          }}
          onClose={() => {
            setOpenDialog(null);
          }}
        />
      )}
      {openDialog === "import" && (
        <ImportTemplateDialog
          onImported={(importedTemplate) => {
            setOpenDialog(null);
            openTemplate(importedTemplate.id, false);
          }}
          onClose={() => {
            setOpenDialog(null);
          }}
        />
      )}
    </div>
  );
}
