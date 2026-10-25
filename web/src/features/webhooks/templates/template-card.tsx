import { Link } from "@tanstack/react-router";
import {
  BotIcon,
  BracesIcon,
  FileCodeIcon,
  KeyRoundIcon,
  type LucideIcon,
  MailIcon,
  MessageSquareIcon,
  WorkflowIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { TemplateCategory, WebhookTemplateSummary } from "@/lib/api/types";

/** Monochrome icons by category; no third-party logos (WH-08.3). */
const categoryIcons: Record<TemplateCategory, LucideIcon> = {
  generic: BracesIcon,
  "email-provider": MailIcon,
  "sms-provider": MessageSquareIcon,
  chat: BotIcon,
  automation: WorkflowIcon,
  custom: FileCodeIcon,
};

export const templateSourceLabels: Record<
  WebhookTemplateSummary["source"],
  string
> = {
  builtin: "Built-in",
  custom: "Custom",
  file: "From file",
};

const shownEventLimit = 3;

/** One template in the gallery; opens its detail. */
export function TemplateCard({
  webhookTemplate,
}: {
  webhookTemplate: WebhookTemplateSummary;
}) {
  const CategoryIcon = categoryIcons[webhookTemplate.category];
  const hiddenEventCount = webhookTemplate.events.length - shownEventLimit;

  return (
    <li>
      <Link
        to="/webhooks/templates"
        search={(previousSearch) => ({
          ...previousSearch,
          template: webhookTemplate.id,
        })}
        data-testid="template-card"
        className="flex h-full flex-col gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted/40">
            <CategoryIcon aria-hidden="true" className="size-4" />
          </span>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="truncate font-medium">{webhookTemplate.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {webhookTemplate.service}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-end gap-1">
            <Badge
              variant={
                webhookTemplate.source === "builtin" ? "secondary" : "outline"
              }
            >
              {templateSourceLabels[webhookTemplate.source]}
            </Badge>
            {webhookTemplate.is_modified && (
              <Badge variant="outline">Modified</Badge>
            )}
          </span>
        </span>
        <span className="flex flex-wrap gap-1">
          {webhookTemplate.events.slice(0, shownEventLimit).map((eventType) => (
            <span
              key={eventType}
              className="rounded border px-1 font-mono text-[11px]"
            >
              {eventType}
            </span>
          ))}
          {hiddenEventCount > 0 && (
            <span className="text-[11px] text-muted-foreground">
              +{hiddenEventCount} more
            </span>
          )}
        </span>
        {webhookTemplate.required_variables.length > 0 && (
          <span className="mt-auto flex items-center gap-1 text-xs text-muted-foreground">
            <KeyRoundIcon aria-hidden="true" className="size-3.5" />
            Needs {webhookTemplate.required_variables.length} variable
            {webhookTemplate.required_variables.length === 1 ? "" : "s"}
          </span>
        )}
      </Link>
    </li>
  );
}
