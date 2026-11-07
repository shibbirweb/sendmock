import { fileURLToPath } from "node:url";

import type { InventoryControl } from "./inventory-builder";

/** The committed inventory the Deeper pages are checked against. */
export const inventoryFilePath = fileURLToPath(
  new URL("inventory.json", import.meta.url),
);

export type ScreenInventory = {
  path: string;
  /** Per data state; `empty` and `failing` hold only what they add to `normal`. */
  states: Record<string, string[]>;
};

export type DeeperInventory = {
  shell: string[];
  screens: ScreenInventory[];
};

/** `button: Delete all emails`, or `each item, checkbox: Select email from …`. */
export function describeControl(control: InventoryControl): string {
  return `${control.isPerItem ? "each item, " : ""}${control.role}: ${control.name}`;
}

export function renderInventoryFile(inventory: DeeperInventory): string {
  return `${JSON.stringify(inventory, null, 2)}\n`;
}
