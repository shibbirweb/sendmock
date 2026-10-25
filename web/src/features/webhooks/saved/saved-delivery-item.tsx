import {
  ChevronDownIcon,
  FileCodeIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
} from "lucide-react";
import * as React from "react";

import { HttpBodyView } from "@/components/common/http-body-view";
import { HttpHeadersList } from "@/components/common/http-headers-list";
import { Button } from "@/components/ui/button";
import type { SavedDelivery } from "@/lib/api/types";
import { formatDateTime, formatRelativeTime } from "@/lib/format/format-values";
import { cn } from "@/lib/utils";

export type SavedDeliveryAction = "send" | "rename" | "template" | "delete";

/** One bookmark: name, target and when it was saved; opens to its stored request (WH-10.4). */
export function SavedDeliveryItem({
  savedDelivery,
  endpointName,
  templateName,
  onAction,
}: {
  savedDelivery: SavedDelivery;
  endpointName: string | null;
  templateName: string;
  onAction: (savedAction: SavedDeliveryAction) => void;
}) {
  const [isExpanded, setExpanded] = React.useState(false);
  const detailsId = React.useId();
  const actionButtons: {
    savedAction: SavedDeliveryAction;
    label: string;
    icon: typeof SendIcon;
  }[] = [
    { savedAction: "send", label: "Send", icon: SendIcon },
    { savedAction: "rename", label: "Rename", icon: PencilIcon },
    { savedAction: "template", label: "Save as template", icon: FileCodeIcon },
    { savedAction: "delete", label: "Delete", icon: Trash2Icon },
  ];

  return (
    <li
      data-testid="saved-delivery"
      className="grid gap-3 rounded-lg border p-3"
    >
      <div className="flex flex-wrap items-start gap-3">
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={detailsId}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-sm text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          onClick={() => {
            setExpanded((wasExpanded) => !wasExpanded);
          }}
        >
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              "mt-0.5 size-4 shrink-0 transition-transform",
              !isExpanded && "-rotate-90",
            )}
          />
          <span className="grid min-w-0 gap-0.5">
            <span className="truncate font-medium">{savedDelivery.name}</span>
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="rounded border px-1 font-mono text-[10px]">
                {savedDelivery.request.method}
              </span>
              <span className="truncate font-mono">
                {savedDelivery.request.url}
              </span>
            </span>
            <span className="text-xs text-muted-foreground">
              {endpointName === null
                ? "From the composer"
                : `From ${endpointName}`}{" "}
              · {templateName}
              {" · "}
              <time
                dateTime={savedDelivery.saved_at}
                title={formatDateTime(savedDelivery.saved_at)}
              >
                saved {formatRelativeTime(savedDelivery.saved_at)}
              </time>
            </span>
          </span>
        </button>
        <div className="flex basis-full flex-wrap justify-end gap-1 sm:basis-auto">
          {actionButtons.map(({ savedAction, label, icon: ActionIcon }) => (
            <Button
              key={savedAction}
              variant={savedAction === "send" ? "outline" : "ghost"}
              size={savedAction === "send" ? "sm" : "icon-sm"}
              aria-label={`${label} ${savedDelivery.name}`}
              title={label}
              onClick={() => {
                onAction(savedAction);
              }}
            >
              <ActionIcon />
              {savedAction === "send" && label}
            </Button>
          ))}
        </div>
      </div>
      {isExpanded && (
        <div id={detailsId} className="grid min-w-0 gap-3 border-t pt-3">
          <HttpHeadersList
            title="Headers"
            headers={savedDelivery.request.headers}
          />
          <HttpBodyView title="Body" bodyText={savedDelivery.request.body} />
        </div>
      )}
    </li>
  );
}
