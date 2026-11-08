import { expect, type Locator } from "@playwright/test";

/**
 * Replaces all the text of a CodeMirror editor. `fill` selects through the DOM, which
 * CodeMirror reads back asynchronously, so its delete could reach CodeMirror while the cursor
 * was still at the start and remove one character instead of everything. Select all through
 * CodeMirror's own keymap makes the whole text CodeMirror's selection before anything is typed.
 */
export async function replaceCodeEditorText(
  codeEditor: Locator,
  newText: string,
) {
  await codeEditor.click();
  await codeEditor.press("ControlOrMeta+a");
  if (newText === "") {
    await codeEditor.press("Backspace");
  } else {
    await codeEditor.page().keyboard.insertText(newText);
  }
  // Each line is its own element, so the text reads back without the line breaks.
  await expect(codeEditor).toHaveText(newText.replaceAll("\n", ""));
}
