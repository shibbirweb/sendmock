import { fileURLToPath } from "node:url";

import type { InventoryControl } from "./inventory-builder";

/** One screen's inventory: its controls per state, and its place in the app's screen order. */
export type ScreenInventory = {
  order: number;
  /** The screen's path, or `shell` for the sidebar and header. */
  path: string;
  /** Per state: `normal`, the overlays, then `empty` and `failing` with only what they add. */
  states: Record<string, string[]>;
};

/** `/webhooks/rules` is `webhooks-rules.json`, `/` is `overview.json`. */
export function toInventoryFilePath(screenPath: string): string {
  const fileKey =
    screenPath === "/"
      ? "overview"
      : screenPath.replace(/^\//, "").replaceAll("/", "-");
  return fileURLToPath(new URL(`inventory/${fileKey}.json`, import.meta.url));
}

/** `button: Delete all emails`, or `each item, checkbox: Select email from …`. */
export function describeControl(control: InventoryControl): string {
  return `${control.isPerItem ? "each item, " : ""}${control.role}: ${control.name}`;
}

export function renderInventoryFile(screenInventory: ScreenInventory): string {
  return `${JSON.stringify(screenInventory, null, 2)}\n`;
}
