/** Styles that change where text wraps; the mirror copies them from the field. */
const mirroredStyleNames = [
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
] as const;

/**
 * Where the caret is inside a textarea or input, in pixels from the field's
 * top-left, by laying the text out in a hidden copy of the field.
 */
export function measureCaretPosition(
  textField: HTMLTextAreaElement | HTMLInputElement,
  caretIndex: number,
): { top: number; left: number; lineHeight: number } {
  const mirrorElement = document.createElement("div");
  const fieldStyle = window.getComputedStyle(textField);
  const isTextarea = textField instanceof HTMLTextAreaElement;
  for (const styleName of mirroredStyleNames) {
    mirrorElement.style[styleName] = fieldStyle[styleName];
  }
  mirrorElement.style.position = "absolute";
  mirrorElement.style.visibility = "hidden";
  mirrorElement.style.top = "0";
  mirrorElement.style.left = "-9999px";
  mirrorElement.style.whiteSpace = isTextarea ? "pre-wrap" : "pre";
  mirrorElement.style.overflowWrap = isTextarea ? "break-word" : "normal";
  mirrorElement.textContent = textField.value.slice(0, caretIndex);
  const caretMarker = document.createElement("span");
  caretMarker.textContent = textField.value.slice(caretIndex) || ".";
  mirrorElement.appendChild(caretMarker);
  document.body.appendChild(mirrorElement);

  const lineHeight =
    Number.parseFloat(fieldStyle.lineHeight) ||
    Number.parseFloat(fieldStyle.fontSize) * 1.4;
  const caretPosition = {
    top: caretMarker.offsetTop - textField.scrollTop,
    left: caretMarker.offsetLeft - textField.scrollLeft,
    lineHeight,
  };
  document.body.removeChild(mirrorElement);

  return caretPosition;
}
