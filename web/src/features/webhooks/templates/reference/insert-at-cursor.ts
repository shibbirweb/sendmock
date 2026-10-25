/** The text with `insertText` put at the field's selection, and the caret after it. */
export function insertAtCursor(
  textField: HTMLTextAreaElement | HTMLInputElement | null,
  currentText: string,
  insertText: string,
): { nextText: string; nextCursorIndex: number } {
  const selectionStart = textField?.selectionStart ?? currentText.length;
  const selectionEnd = textField?.selectionEnd ?? selectionStart;

  return {
    nextText:
      currentText.slice(0, selectionStart) +
      insertText +
      currentText.slice(selectionEnd),
    nextCursorIndex: selectionStart + insertText.length,
  };
}
