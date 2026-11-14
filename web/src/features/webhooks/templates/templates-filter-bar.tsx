import { SearchIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  templateCategoryLabels,
  templateCategoryOrder,
} from "@/features/webhooks/webhook-labels";
import { appEventTypes, type TemplateCategory } from "@/lib/api/types";

const allCategories = "all";
const anyEvent = "any";

export type TemplateFilterChange = {
  category?: TemplateCategory;
  query?: string;
  event?: string;
};

/** Category tabs, name search and event picker above the gallery (WH-08.3). */
/** The gallery the category tabs filter. */
export const templateGalleryId = "template-gallery";

export function TemplatesFilterBar({
  category,
  query,
  event,
  onChange,
}: {
  category: TemplateCategory | undefined;
  query: string | undefined;
  event: string | undefined;
  onChange: (filterChange: TemplateFilterChange) => void;
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <Tabs
          value={category ?? allCategories}
          onValueChange={(selectedCategory) => {
            onChange({
              category:
                selectedCategory === allCategories
                  ? undefined
                  : (selectedCategory as TemplateCategory),
            });
          }}
        >
          <TabsList>
            {/* The tabs filter the gallery, so they control it rather than panels. */}
            <TabsTrigger
              value={allCategories}
              aria-controls={templateGalleryId}
            >
              All
            </TabsTrigger>
            {templateCategoryOrder.map((templateCategory) => (
              <TabsTrigger
                key={templateCategory}
                value={templateCategory}
                aria-controls={templateGalleryId}
              >
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
              onChange({ query: changeEvent.target.value || undefined });
            }}
          />
        </div>
        <Select
          value={event ?? anyEvent}
          onValueChange={(selectedEvent) => {
            onChange({
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
    </>
  );
}
