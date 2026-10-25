import { useNavigate, useSearch } from "@tanstack/react-router";
import { FileCodeIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NoMatchState } from "@/features/onboarding/no-match-state";
import { TemplateCard } from "@/features/webhooks/templates/template-card";
import { TemplateDrawer } from "@/features/webhooks/templates/detail/template-drawer";
import {
  templateCategoryLabels,
  templateCategoryOrder,
} from "@/features/webhooks/webhook-labels";
import { useWebhookTemplates } from "@/lib/api/hooks/use-webhook-queries";
import { appEventTypes, type TemplateCategory } from "@/lib/api/types";

const allCategories = "all";
const anyEvent = "any";

/** Templates gallery: category tabs, search and event filter in the URL (WH-08.3). */
export function TemplatesPage() {
  const { category, query, event } = useSearch({ from: "/webhooks/templates" });
  const navigate = useNavigate({ from: "/webhooks/templates" });
  const templatesQuery = useWebhookTemplates();
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
  const updateSearch = (changedSearch: {
    category?: TemplateCategory;
    query?: string;
    event?: string;
  }) => {
    void navigate({
      search: (previousSearch) => ({ ...previousSearch, ...changedSearch }),
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto grid w-full max-w-6xl min-w-0 grid-cols-1 gap-4 px-4 py-6 sm:px-6">
        <header className="grid gap-1">
          <h2 className="text-xl font-semibold">Webhook templates</h2>
          <p className="text-sm text-muted-foreground">
            Payload formats your endpoints can send: SendMock's own JSON,
            providers your app already parses, chat tools, and your own.
          </p>
        </header>
        <div className="overflow-x-auto">
          <Tabs
            value={category ?? allCategories}
            onValueChange={(selectedCategory) => {
              updateSearch({
                category:
                  selectedCategory === allCategories
                    ? undefined
                    : (selectedCategory as TemplateCategory),
              });
            }}
          >
            <TabsList>
              <TabsTrigger value={allCategories}>All</TabsTrigger>
              {templateCategoryOrder.map((templateCategory) => (
                <TabsTrigger key={templateCategory} value={templateCategory}>
                  {templateCategoryLabels[templateCategory]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:w-72">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query ?? ""}
              placeholder="Search name or service"
              aria-label="Search templates"
              className="pl-8"
              onChange={(changeEvent) => {
                updateSearch({ query: changeEvent.target.value || undefined });
              }}
            />
          </div>
          <Select
            value={event ?? anyEvent}
            onValueChange={(selectedEvent) => {
              updateSearch({
                event: selectedEvent === anyEvent ? undefined : selectedEvent,
              });
            }}
          >
            <SelectTrigger aria-label="Event filter" className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={anyEvent}>Every event</SelectItem>
              {appEventTypes.map((eventType) => (
                <SelectItem
                  key={eventType}
                  value={eventType}
                  className="font-mono text-xs"
                >
                  {eventType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {templatesQuery.isPending && <Skeleton className="h-48 w-full" />}
        {templatesQuery.isError && (
          <div className="flex flex-col items-center gap-3 rounded-lg border p-8 text-center">
            <p className="text-sm text-destructive">
              Could not load the templates.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void templatesQuery.refetch()}
            >
              Try again
            </Button>
          </div>
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
    </div>
  );
}
