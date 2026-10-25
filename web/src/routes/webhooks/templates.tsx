import { createFileRoute } from "@tanstack/react-router";

import { TemplatesPage } from "@/features/webhooks/templates/templates-page";
import type { TemplateCategory } from "@/lib/api/types";

export type TemplatesSearchParams = {
  category?: TemplateCategory;
  /** Search on name and service. */
  query?: string;
  event?: string;
  /** ID of the template whose detail is open. */
  template?: string;
};

const templateCategories: TemplateCategory[] = [
  "generic",
  "email-provider",
  "sms-provider",
  "chat",
  "automation",
  "custom",
];

function readOptionalText(searchValue: unknown): string | undefined {
  return typeof searchValue === "string" && searchValue !== ""
    ? searchValue
    : undefined;
}

export const Route = createFileRoute("/webhooks/templates")({
  validateSearch: (
    searchParams: Record<string, unknown>,
  ): TemplatesSearchParams => ({
    category: templateCategories.includes(
      searchParams.category as TemplateCategory,
    )
      ? (searchParams.category as TemplateCategory)
      : undefined,
    query: readOptionalText(searchParams.query),
    event: readOptionalText(searchParams.event),
    template: readOptionalText(searchParams.template),
  }),
  component: TemplatesPage,
});
