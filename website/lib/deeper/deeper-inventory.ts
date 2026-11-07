import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { DeeperState } from "./deeper-types";

/** The inventory the crawl of the demo writes (`web/tests/deeper/`, WS-10.3). */
const inventoryFilePath = fileURLToPath(
  new URL("../../../web/tests/deeper/inventory.json", import.meta.url),
);

type DeeperInventoryFile = {
  shell: string[];
  screens: { path: string; states: Partial<Record<DeeperState, string[]>> }[];
};

export type ScreenState = { state: DeeperState; controls: string[] };

export function loadDeeperInventory(): DeeperInventoryFile {
  return JSON.parse(
    readFileSync(inventoryFilePath, "utf8"),
  ) as DeeperInventoryFile;
}

/** Every screen the crawl read, `shell` first. */
export function listInventoryScreens(inventory: DeeperInventoryFile): string[] {
  return ["shell", ...inventory.screens.map((screen) => screen.path)];
}

/** A screen's controls per data state, in screen order; empty states are left out. */
export function listScreenStates(
  inventory: DeeperInventoryFile,
  screen: string,
): ScreenState[] {
  if (screen === "shell") {
    return [{ state: "normal", controls: inventory.shell }];
  }
  const screenInventory = inventory.screens.find(
    (inventoryScreen) => inventoryScreen.path === screen,
  );
  const stateOrder: DeeperState[] = ["normal", "empty", "failing"];
  return stateOrder
    .map((state) => ({
      state,
      controls: screenInventory?.states[state] ?? [],
    }))
    .filter((screenState) => screenState.controls.length > 0);
}
