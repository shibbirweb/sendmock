import * as React from "react";

import { ListRowCheckbox } from "@/components/common/list-row-checkbox";
import { TableCell, TableHead, TableRow } from "@/components/ui/table";
import { isRowCheckKey } from "@/features/shortcuts/is-row-check-key";
import type { CheckedItems } from "@/hooks/use-checked-items";
import { cn } from "@/lib/utils";

/** The header cell above the row tick boxes. */
export function CheckColumnHead() {
  return (
    <TableHead className="w-8 pr-0">
      <span className="sr-only">Select</span>
    </TableHead>
  );
}

/**
 * A table row with a tick box first (UI-14.1). The rows keep their stretched
 * link, so the box sits above it; X on the focused row ticks it too.
 */
export function CheckableTableRow({
  itemId,
  itemLabel,
  checkedItems,
  className,
  children,
  ...rowProps
}: Omit<React.ComponentProps<typeof TableRow>, "onKeyDown"> & {
  itemId: string;
  /** Names the row for screen readers, e.g. "push to dQw4w9WgXcQ". */
  itemLabel: string;
  checkedItems: CheckedItems;
}) {
  const isChecked = checkedItems.isItemChecked(itemId);

  return (
    <TableRow
      {...rowProps}
      data-state={isChecked ? "selected" : undefined}
      className={cn("group/list-row relative", className)}
      onKeyDown={(keyEvent) => {
        if (isRowCheckKey(keyEvent)) {
          keyEvent.preventDefault();
          checkedItems.toggleItemChecked(itemId);
        }
      }}
    >
      <TableCell className="w-8 pr-0">
        <ListRowCheckbox
          itemLabel={itemLabel}
          isChecked={isChecked}
          isAnyChecked={checkedItems.checkedItemCount > 0}
          onCheckedChange={(isNowChecked) => {
            checkedItems.setItemChecked(itemId, isNowChecked);
          }}
        />
      </TableCell>
      {children}
    </TableRow>
  );
}
