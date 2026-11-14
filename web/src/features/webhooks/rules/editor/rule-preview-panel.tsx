import { CheckIcon, MailIcon, MessageSquareIcon } from "lucide-react";
import * as React from "react";

import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRulePreview } from "@/lib/api/hooks/use-webhook-rule-queries";
import type { RulePreviewItem, RulePreviewRequest } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/format/format-values";
import { readEventSubjects } from "@/lib/webhooks/rule-filter/rule-fields";
import { cn } from "@/lib/utils";

const previewDebounceMs = 300;

function PreviewItemRow({ previewItem }: { previewItem: RulePreviewItem }) {
  const MessageIcon =
    previewItem.message_kind === "email" ? MailIcon : MessageSquareIcon;

  return (
    <li
      data-testid="preview-item"
      data-match={previewItem.is_match}
      className={cn(
        "flex items-start gap-2 rounded-md px-2 py-1.5 text-sm",
        previewItem.is_match ? "bg-muted/60" : "text-muted-foreground",
      )}
    >
      <MessageIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span className="grid min-w-0 flex-1">
        <span className="truncate">{previewItem.title}</span>
        <span className="truncate text-xs text-muted-foreground">
          {previewItem.detail}
        </span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {formatRelativeTime(previewItem.created_at)}
      </span>
      {previewItem.is_match && (
        <CheckIcon aria-label="Matches" className="mt-0.5 size-4 shrink-0" />
      )}
    </li>
  );
}

/** "Matches N of the last 50 messages", live while the filter changes (WH-02.3). */
export function RulePreviewPanel({
  previewRequest,
  isFilterComplete,
}: {
  previewRequest: RulePreviewRequest;
  isFilterComplete: boolean;
}) {
  const switchId = React.useId();
  const [isShowingNonMatching, setShowingNonMatching] = React.useState(false);
  // Debounce the text: a new request object every render would never settle.
  const debouncedRequestText = useDebouncedValue(
    JSON.stringify(previewRequest),
    previewDebounceMs,
  );
  const debouncedRequest = React.useMemo(
    () => JSON.parse(debouncedRequestText) as RulePreviewRequest,
    [debouncedRequestText],
  );
  const hasPreviewableEvents = readEventSubjects(previewRequest.events).some(
    (eventSubject) => eventSubject !== "opened",
  );
  const previewQuery = useRulePreview(
    debouncedRequest,
    hasPreviewableEvents && isFilterComplete,
  );

  if (!hasPreviewableEvents) {
    return (
      <p className="text-sm text-muted-foreground">
        {previewRequest.events.length === 0
          ? "Pick events to preview which recent messages would match."
          : "Verify, HTTP and webhook events have no filter fields, so there is nothing to preview."}
      </p>
    );
  }

  const previewResult = previewQuery.data;
  const visibleItems = (previewResult?.items ?? []).filter(
    (previewItem) => isShowingNonMatching || previewItem.is_match,
  );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          data-testid="preview-summary"
          aria-live="polite"
          className="text-sm font-medium"
        >
          {previewResult === undefined
            ? "Checking recent messages..."
            : `Matches ${previewResult.match_count} of the last ${previewResult.checked_count} messages`}
        </p>
        <div className="flex items-center gap-2">
          <Switch
            id={switchId}
            checked={isShowingNonMatching}
            onCheckedChange={setShowingNonMatching}
          />
          <Label htmlFor={switchId} className="text-xs font-normal">
            Show non-matching
          </Label>
        </div>
      </div>
      {!isFilterComplete && (
        <p className="text-xs text-muted-foreground">
          Finish the incomplete conditions to update the preview.
        </p>
      )}
      {previewQuery.isPending && <Skeleton className="h-24 w-full" />}
      {previewResult !== undefined && visibleItems.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No recent message matches.
        </p>
      )}
      {/* Focusable so keyboard users can scroll the matches (UI-05.1). */}
      <ul
        aria-label="Preview"
        tabIndex={0}
        className="grid max-h-72 gap-0.5 overflow-y-auto rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {visibleItems.map((previewItem) => (
          <PreviewItemRow
            key={previewItem.message_id}
            previewItem={previewItem}
          />
        ))}
      </ul>
    </div>
  );
}
