/** True while the user types in a field, so single-key shortcuts stay quiet. */
export function isTypingInEditableElement(
  eventTarget: EventTarget | null,
): boolean {
  if (!(eventTarget instanceof HTMLElement)) {
    return false;
  }

  if (eventTarget.isContentEditable) {
    return true;
  }

  return (
    eventTarget.closest("input, textarea, select, [contenteditable='true']") !==
    null
  );
}
