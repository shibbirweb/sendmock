import * as React from "react";

/**
 * Remembers what had focus when an overlay opened, and returns focus there
 * when it closes (UI-05.1). Radix only does this for its own trigger
 * element; our sheets and dialogs open from state, so they need this.
 */
export function useRestoreFocusOnClose(
  onCloseAutoFocus: ((closeEvent: Event) => void) | undefined,
) {
  const [openerElement] = React.useState(() =>
    typeof document === "undefined" ? null : document.activeElement,
  );

  return (closeEvent: Event) => {
    onCloseAutoFocus?.(closeEvent);
    if (closeEvent.defaultPrevented) {
      return;
    }
    if (openerElement instanceof HTMLElement && openerElement.isConnected) {
      closeEvent.preventDefault();
      openerElement.focus();
    }
  };
}
