import { describe, expect, test } from "vitest";

import {
  trackInputModality,
  wasFocusMovedByKeyboard,
} from "@/lib/keyboard/input-modality";

describe("input modality", () => {
  test("Tab and the arrow keys move focus by keyboard; Enter, Escape and a click do not", () => {
    trackInputModality();
    trackInputModality();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    expect(wasFocusMovedByKeyboard()).toBe(true);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(wasFocusMovedByKeyboard()).toBe(false);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(wasFocusMovedByKeyboard()).toBe(true);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(wasFocusMovedByKeyboard()).toBe(false);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
    window.dispatchEvent(new PointerEvent("pointerdown"));
    expect(wasFocusMovedByKeyboard()).toBe(false);
  });
});
