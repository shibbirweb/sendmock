/**
 * X on a focused table row ticks or clears its checkbox (UI-14.1), as X does
 * for the open item on the Mail and SMS lists.
 */
export function isRowCheckKey(keyboardEvent: React.KeyboardEvent): boolean {
  const hasModifier =
    keyboardEvent.metaKey || keyboardEvent.ctrlKey || keyboardEvent.altKey;

  return !hasModifier && keyboardEvent.key.toLowerCase() === "x";
}
