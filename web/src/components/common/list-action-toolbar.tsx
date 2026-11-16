import { MailIcon, MailOpenIcon, Trash2Icon } from "lucide-react";
import * as React from "react";

import { ConfirmActionDialog } from "@/components/common/confirm-action-dialog";
import { IconButton } from "@/components/common/icon-button";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

/** How the list names one item and several, e.g. `{ one: "email", many: "emails" }`. */
export type ListItemNoun = { one: string; many: string };

export function countItems(itemCount: number, itemNoun: ListItemNoun) {
  return `${itemCount} ${itemCount === 1 ? itemNoun.one : itemNoun.many}`;
}

type ListActionToolbarProps = {
  itemNoun: ListItemNoun;
  loadedItemCount: number;
  totalItemCount: number;
  checkedItemCount: number;
  onToggleAllChecked: (isChecked: boolean) => void;
  /** Lists with read state pass both; the others leave them out. */
  onMarkCheckedRead?: () => void;
  onMarkCheckedUnread?: () => void;
  onDeleteChecked: () => void;
  /** A search or filter is on, so Delete all removes only the matching items. */
  isFiltered: boolean;
  /** What a delete all keeps besides the configuration, e.g. queued deliveries. */
  deleteAllKeepsNote?: string;
  /** The picked project, which a delete all is limited to. */
  projectKey?: string;
  onDeleteAll: () => void;
  /** Tools shown while nothing is checked, such as Import or notifications. */
  children?: React.ReactNode;
};

type PendingConfirmation = "delete-checked" | "delete-all" | null;

/**
 * The same toolbar above every traffic list (UI-14): select all, act on the
 * checked rows, and delete everything or what the filter shows.
 */
export function ListActionToolbar(toolbarProps: ListActionToolbarProps) {
  const { itemNoun, loadedItemCount, totalItemCount, checkedItemCount } =
    toolbarProps;
  const [pendingConfirmation, setPendingConfirmation] =
    React.useState<PendingConfirmation>(null);
  const hasChecked = checkedItemCount > 0;
  const isAllChecked =
    loadedItemCount > 0 && checkedItemCount === loadedItemCount;
  const closeConfirmation = () => {
    setPendingConfirmation(null);
  };

  return (
    <div
      data-list-action-toolbar
      className="flex h-10 shrink-0 items-center gap-2 border-b px-3 text-xs text-muted-foreground"
    >
      <Checkbox
        checked={isAllChecked ? true : hasChecked ? "indeterminate" : false}
        onCheckedChange={(checkedState) => {
          toolbarProps.onToggleAllChecked(checkedState === true);
        }}
        aria-label={`Select all loaded ${itemNoun.many}`}
        disabled={loadedItemCount === 0}
      />
      <span aria-live="polite">
        {hasChecked
          ? `${checkedItemCount} selected`
          : countItems(totalItemCount, itemNoun)}
      </span>
      <div className="ml-auto flex items-center gap-1">
        {hasChecked ? (
          <CheckedItemActions
            onMarkCheckedRead={toolbarProps.onMarkCheckedRead}
            onMarkCheckedUnread={toolbarProps.onMarkCheckedUnread}
            onAskToDelete={() => {
              setPendingConfirmation("delete-checked");
            }}
          />
        ) : (
          <>
            {toolbarProps.children}
            <IconButton
              variant="ghost"
              label={
                toolbarProps.isFiltered
                  ? `Delete matching ${itemNoun.many}`
                  : `Delete all ${itemNoun.many}`
              }
              disabled={totalItemCount === 0}
              onClick={() => {
                setPendingConfirmation("delete-all");
              }}
            >
              <Trash2Icon />
            </IconButton>
          </>
        )}
      </div>
      <ConfirmActionDialog
        isOpen={pendingConfirmation === "delete-checked"}
        title={`Delete ${countItems(checkedItemCount, itemNoun)}?`}
        consequence="They go for good; nothing else changes."
        confirmLabel="Delete"
        isDestructive
        onConfirm={toolbarProps.onDeleteChecked}
        onClose={closeConfirmation}
      />
      <ConfirmActionDialog
        isOpen={pendingConfirmation === "delete-all"}
        {...describeDeleteAll(toolbarProps)}
        isDestructive
        onConfirm={toolbarProps.onDeleteAll}
        onClose={closeConfirmation}
      />
    </div>
  );
}

function CheckedItemActions({
  onMarkCheckedRead,
  onMarkCheckedUnread,
  onAskToDelete,
}: {
  onMarkCheckedRead?: () => void;
  onMarkCheckedUnread?: () => void;
  onAskToDelete: () => void;
}) {
  return (
    <>
      {onMarkCheckedRead !== undefined && (
        <Button variant="ghost" size="sm" onClick={onMarkCheckedRead}>
          <MailOpenIcon />
          Mark read
        </Button>
      )}
      {onMarkCheckedUnread !== undefined && (
        <Button variant="ghost" size="sm" onClick={onMarkCheckedUnread}>
          <MailIcon />
          Mark unread
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={onAskToDelete}>
        <Trash2Icon />
        Delete
      </Button>
    </>
  );
}

/** The confirmation names what goes, how many and what stays (UI-14.4). */
function describeDeleteAll({
  itemNoun,
  totalItemCount,
  isFiltered,
  deleteAllKeepsNote,
  projectKey,
}: ListActionToolbarProps) {
  const projectPart =
    projectKey === undefined ? "" : ` in project ${projectKey}`;
  const keepsPart = [
    isFiltered ? `Other ${itemNoun.many} stay.` : null,
    deleteAllKeepsNote ?? null,
    "Settings and configuration stay.",
  ]
    .filter((sentence) => sentence !== null)
    .join(" ");

  return {
    title: isFiltered
      ? `Delete the ${countItems(totalItemCount, itemNoun)} that match${projectPart}?`
      : `Delete all ${countItems(totalItemCount, itemNoun)}${projectPart}?`,
    consequence: `${keepsPart} This cannot be undone.`,
    confirmLabel: isFiltered ? "Delete matching" : "Delete all",
  };
}
