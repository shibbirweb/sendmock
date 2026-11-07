import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The inventory the crawl of the demo writes (`web/tests/deeper/`, WS-10.3). */
const inventoryFilePath = fileURLToPath(
  new URL("../../../web/tests/deeper/inventory.json", import.meta.url),
);

type DeeperInventoryFile = {
  shell: string[];
  screens: { path: string; states: Record<string, string[]> }[];
};

/** `normal`, `empty`, `failing`, or the name of a tab, dialog or menu the crawl opened. */
export type ScreenState = { state: string; controls: string[] };

export function loadDeeperInventory(): DeeperInventoryFile {
  return JSON.parse(
    readFileSync(inventoryFilePath, "utf8"),
  ) as DeeperInventoryFile;
}

/** Every screen the crawl read, `shell` first. */
export function listInventoryScreens(inventory: DeeperInventoryFile): string[] {
  return ["shell", ...inventory.screens.map((screen) => screen.path)];
}

/**
 * A screen's controls per state, in screen order: the normal state, the tabs, dialogs and
 * menus the crawl opened, then the empty and failing data states; empty states are left out.
 */
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
  return Object.entries(screenInventory?.states ?? {})
    .map(([state, controls]) => ({ state, controls }))
    .filter((screenState) => screenState.controls.length > 0);
}
