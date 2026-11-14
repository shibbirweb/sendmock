/** Keys that move focus from one control to the next. */
const focusNavigationKeys = new Set([
  "Tab",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
]);

let isLastInputFocusNavigation = false;
let isTrackingInputModality = false;

/**
 * Starts noting whether the last input was a key that moves focus or
 * something else (a click, Enter, Escape). Safe to call more than once; the
 * listeners are added only the first time.
 */
export function trackInputModality() {
  if (isTrackingInputModality || typeof window === "undefined") {
    return;
  }
  isTrackingInputModality = true;
  window.addEventListener(
    "keydown",
    (keyboardEvent) => {
      isLastInputFocusNavigation = focusNavigationKeys.has(keyboardEvent.key);
    },
    { capture: true },
  );
  window.addEventListener(
    "pointerdown",
    () => {
      isLastInputFocusNavigation = false;
    },
    { capture: true },
  );
}

/**
 * True when focus arrived by Tab or the arrow keys, not moved by a menu,
 * dialog or sheet after a click, Enter or Escape.
 */
export function wasFocusMovedByKeyboard(): boolean {
  return isLastInputFocusNavigation;
}
