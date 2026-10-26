"use client";

import { type KeyboardEvent, useId, useState } from "react";

/**
 * A row of tabs that the Left and Right arrow keys move through, focus
 * following the selected tab (WAI-ARIA tabs with automatic activation).
 */
export function useArrowKeyTabs(tabCount: number) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const tabsId = useId();

  const moveSelection = (keyboardEvent: KeyboardEvent<HTMLElement>) => {
    const step =
      keyboardEvent.key === "ArrowRight"
        ? 1
        : keyboardEvent.key === "ArrowLeft"
          ? -1
          : 0;
    if (step === 0) {
      return;
    }
    keyboardEvent.preventDefault();
    const nextIndex = (selectedIndex + step + tabCount) % tabCount;
    setSelectedIndex(nextIndex);
    document.getElementById(`${tabsId}-tab-${nextIndex}`)?.focus();
  };

  return {
    selectedIndex,
    setSelectedIndex,
    moveSelection,
    tabId: (tabIndex: number) => `${tabsId}-tab-${tabIndex}`,
    panelId: `${tabsId}-panel`,
  };
}
