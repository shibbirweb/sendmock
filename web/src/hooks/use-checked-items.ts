import * as React from "react";

export type CheckedItems = {
  checkedItemIds: ReadonlySet<string>;
  checkedItemCount: number;
  isItemChecked: (itemId: string) => boolean;
  setItemChecked: (itemId: string, isChecked: boolean) => void;
  toggleItemChecked: (itemId: string) => void;
  setAllItemsChecked: (isChecked: boolean) => void;
  /** Runs the action for each checked item, then clears the selection. */
  runForCheckedItems: (itemAction: (itemId: string) => void) => void;
};

type Selection = { resetKey: string; checkedIds: ReadonlySet<string> };

const noCheckedIds: ReadonlySet<string> = new Set();

/**
 * The rows ticked in a list toolbar (UI-14). The selection clears when the
 * filter changes (`selectionResetKey`) and forgets rows that left the list.
 */
export function useCheckedItems(
  loadedItemIds: readonly string[],
  selectionResetKey: string,
): CheckedItems {
  const [selection, setSelection] = React.useState<Selection>(() => ({
    resetKey: selectionResetKey,
    checkedIds: noCheckedIds,
  }));
  const storedCheckedIds =
    selection.resetKey === selectionResetKey
      ? selection.checkedIds
      : noCheckedIds;
  const visibleCheckedIds = React.useMemo(
    () =>
      new Set(loadedItemIds.filter((itemId) => storedCheckedIds.has(itemId))),
    [loadedItemIds, storedCheckedIds],
  );

  const replaceCheckedIds = (
    buildCheckedIds: (currentIds: ReadonlySet<string>) => ReadonlySet<string>,
  ) => {
    setSelection((previousSelection) => ({
      resetKey: selectionResetKey,
      checkedIds: buildCheckedIds(
        previousSelection.resetKey === selectionResetKey
          ? previousSelection.checkedIds
          : noCheckedIds,
      ),
    }));
  };
  const setItemChecked = (itemId: string, isChecked: boolean) => {
    replaceCheckedIds((currentIds) => {
      const nextIds = new Set(currentIds);
      if (isChecked) {
        nextIds.add(itemId);
      } else {
        nextIds.delete(itemId);
      }

      return nextIds;
    });
  };

  return {
    checkedItemIds: visibleCheckedIds,
    checkedItemCount: visibleCheckedIds.size,
    isItemChecked: (itemId) => visibleCheckedIds.has(itemId),
    setItemChecked,
    toggleItemChecked: (itemId) => {
      setItemChecked(itemId, !visibleCheckedIds.has(itemId));
    },
    setAllItemsChecked: (isChecked) => {
      replaceCheckedIds(() =>
        isChecked ? new Set(loadedItemIds) : noCheckedIds,
      );
    },
    runForCheckedItems: (itemAction) => {
      for (const itemId of visibleCheckedIds) {
        itemAction(itemId);
      }
      replaceCheckedIds(() => noCheckedIds);
    },
  };
}
