import * as React from "react";

import {
  ListActionToolbar,
  type ListItemNoun,
} from "@/components/common/list-action-toolbar";
import type { CheckedItems } from "@/hooks/use-checked-items";

/**
 * The list toolbar wired to a selection: the checked-row actions run the
 * per-item operation for each checked row, as Mail does (UI-14.2).
 */
export function CheckedListToolbar({
  itemNoun,
  checkedItems,
  loadedItemCount,
  totalItemCount,
  isFiltered,
  projectKey,
  deleteAllKeepsNote,
  onMarkItem,
  onDeleteItem,
  onDeleteAll,
  children,
}: {
  itemNoun: ListItemNoun;
  checkedItems: CheckedItems;
  loadedItemCount: number;
  totalItemCount: number;
  isFiltered: boolean;
  projectKey?: string;
  deleteAllKeepsNote?: string;
  /** Lists with read state mark a row read (true) or unread (false). */
  onMarkItem?: (itemId: string, isRead: boolean) => void;
  onDeleteItem: (itemId: string) => void;
  onDeleteAll: () => void;
  children?: React.ReactNode;
}) {
  const markCheckedItems =
    onMarkItem === undefined
      ? undefined
      : (isRead: boolean) => {
          checkedItems.runForCheckedItems((itemId) => {
            onMarkItem(itemId, isRead);
          });
        };

  return (
    <ListActionToolbar
      itemNoun={itemNoun}
      loadedItemCount={loadedItemCount}
      totalItemCount={totalItemCount}
      checkedItemCount={checkedItems.checkedItemCount}
      onToggleAllChecked={checkedItems.setAllItemsChecked}
      onMarkCheckedRead={
        markCheckedItems &&
        (() => {
          markCheckedItems(true);
        })
      }
      onMarkCheckedUnread={
        markCheckedItems &&
        (() => {
          markCheckedItems(false);
        })
      }
      onDeleteChecked={() => {
        checkedItems.runForCheckedItems(onDeleteItem);
      }}
      isFiltered={isFiltered}
      projectKey={projectKey}
      deleteAllKeepsNote={deleteAllKeepsNote}
      onDeleteAll={onDeleteAll}
    >
      {children}
    </ListActionToolbar>
  );
}
