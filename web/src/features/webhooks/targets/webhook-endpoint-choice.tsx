import { Link } from "@tanstack/react-router";
import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import type { WebhookEndpoint } from "@/lib/api/types";

/** Whether an endpoint's name or URL contains the search text. */
export function matchesSearch(
  webhookEndpoint: WebhookEndpoint,
  searchText: string,
) {
  const normalizedSearch = searchText.trim().toLowerCase();

  return (
    normalizedSearch === "" ||
    webhookEndpoint.name.toLowerCase().includes(normalizedSearch) ||
    webhookEndpoint.url.toLowerCase().includes(normalizedSearch)
  );
}

/**
 * The checked endpoints that can still receive, in the endpoint list's order,
 * as the picker hands them to the action (WH-13.4).
 */
export function readChosenEndpointIds(
  webhookEndpoints: WebhookEndpoint[],
  checkedEndpointIds: string[],
): string[] {
  return webhookEndpoints
    .filter(
      (webhookEndpoint) =>
        webhookEndpoint.is_enabled &&
        checkedEndpointIds.includes(webhookEndpoint.id),
    )
    .map((webhookEndpoint) => webhookEndpoint.id);
}

/** One endpoint in the picker: its checkbox, its name opening it in a new tab, and its URL. */
export function EndpointChoice({
  webhookEndpoint,
  isChecked,
  onCheckedChange,
}: {
  webhookEndpoint: WebhookEndpoint;
  isChecked: boolean;
  onCheckedChange: (isChecked: boolean) => void;
}) {
  const checkboxId = React.useId();

  return (
    <li className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
      <Checkbox
        id={checkboxId}
        checked={isChecked}
        aria-label={`Send to ${webhookEndpoint.name}`}
        className="mt-0.5"
        onCheckedChange={(checkedState) => {
          onCheckedChange(checkedState === true);
        }}
      />
      <div className="grid min-w-0 gap-0.5">
        <Link
          to="/webhooks/endpoints"
          search={{ endpoint: webhookEndpoint.id }}
          target="_blank"
          rel="noopener"
          className="text-sm font-medium underline-offset-4 hover:underline"
        >
          {webhookEndpoint.name}
        </Link>
        <label
          htmlFor={checkboxId}
          className="truncate font-mono text-xs text-muted-foreground"
        >
          {webhookEndpoint.url}
        </label>
      </div>
    </li>
  );
}
