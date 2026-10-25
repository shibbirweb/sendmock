import * as React from "react";

import { isTypingInEditableElement } from "@/features/shortcuts/is-typing-in-editable-element";

type ListKeyboardShortcutOptions = {
  itemIds: string[];
  selectedItemId: string | undefined;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onOpenItemAt: (itemIndex: number) => void;
  /** Leave out on lists where D should do nothing. */
  onDeleteSelectedItem?: (itemId: string) => void;
};

/**
 * Shortcuts shared by the list screens: J / K open the next or previous item,
 * Enter opens the first one, D deletes the open item and / focuses search.
 */
export function useListKeyboardShortcuts({
  itemIds,
  selectedItemId,
  searchInputRef,
  onOpenItemAt,
  onDeleteSelectedItem,
}: ListKeyboardShortcutOptions) {
  React.useEffect(() => {
    const openItemAt = (itemIndex: number) => {
      if (itemIds[itemIndex] === undefined) {
        return;
      }

      onOpenItemAt(itemIndex);
    };

    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      const hasModifier =
        keyboardEvent.metaKey || keyboardEvent.ctrlKey || keyboardEvent.altKey;
      if (hasModifier || isTypingInEditableElement(keyboardEvent.target)) {
        return;
      }

      const selectedIndex = itemIds.findIndex(
        (itemId) => itemId === selectedItemId,
      );
      const pressedKey = keyboardEvent.key.toLowerCase();

      if (keyboardEvent.key === "/") {
        keyboardEvent.preventDefault();
        searchInputRef.current?.focus();
      } else if (pressedKey === "j") {
        openItemAt(Math.min(selectedIndex + 1, itemIds.length - 1));
      } else if (pressedKey === "k") {
        openItemAt(Math.max(selectedIndex - 1, 0));
      } else if (keyboardEvent.key === "Enter" && selectedIndex === -1) {
        openItemAt(0);
      } else if (
        pressedKey === "d" &&
        selectedItemId !== undefined &&
        onDeleteSelectedItem !== undefined
      ) {
        onDeleteSelectedItem(selectedItemId);
        openItemAt(Math.min(selectedIndex + 1, itemIds.length - 1));
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    itemIds,
    selectedItemId,
    searchInputRef,
    onOpenItemAt,
    onDeleteSelectedItem,
  ]);
}
