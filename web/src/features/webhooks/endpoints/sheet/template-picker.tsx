import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  templateCategoryLabels,
  templateCategoryOrder,
} from "@/features/webhooks/webhook-labels";
import type { WebhookTemplateSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** Searchable template list grouped by category. */
export function TemplatePicker({
  pickerId,
  webhookTemplates,
  selectedTemplateId,
  onSelect,
}: {
  pickerId: string;
  webhookTemplates: WebhookTemplateSummary[];
  selectedTemplateId: string;
  onSelect: (webhookTemplate: WebhookTemplateSummary) => void;
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectedTemplate = webhookTemplates.find(
    (webhookTemplate) => webhookTemplate.id === selectedTemplateId,
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          id={pickerId}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selectedTemplate?.name ?? selectedTemplateId}
          </span>
          <ChevronsUpDownIcon className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) p-0"
      >
        <Command>
          <CommandInput placeholder="Search templates" />
          <CommandList>
            <CommandEmpty>No template matches.</CommandEmpty>
            {templateCategoryOrder.map((templateCategory) => {
              const categoryTemplates = webhookTemplates.filter(
                (webhookTemplate) =>
                  webhookTemplate.category === templateCategory,
              );
              if (categoryTemplates.length === 0) {
                return null;
              }

              return (
                <CommandGroup
                  key={templateCategory}
                  heading={templateCategoryLabels[templateCategory]}
                >
                  {categoryTemplates.map((webhookTemplate) => (
                    <CommandItem
                      key={webhookTemplate.id}
                      value={`${webhookTemplate.name} ${webhookTemplate.service} ${webhookTemplate.id}`}
                      onSelect={() => {
                        onSelect(webhookTemplate);
                        setIsOpen(false);
                      }}
                    >
                      <CheckIcon
                        className={cn(
                          webhookTemplate.id === selectedTemplateId
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <span className="truncate">{webhookTemplate.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
