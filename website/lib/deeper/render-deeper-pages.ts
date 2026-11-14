import { fileURLToPath } from "node:url";

import { listScreenStates, loadDeeperInventory } from "./deeper-inventory";
import { deeperPages } from "./deeper-pages";
import { indexOperationSurfaces } from "./deeper-surfaces";
import { renderDeeperPage } from "./render-deeper-page";

export const deeperDirectory = fileURLToPath(
  new URL("../../../docs/wiki/deeper", import.meta.url),
);

/** Each Deeper page's file (relative to `docs/wiki/deeper/`) with its fresh Markdown. */
export function renderDeeperPages(): Map<string, string> {
  const inventory = loadDeeperInventory();
  const surfacesById = indexOperationSurfaces();
  return new Map([
    ["index.md", renderDeeperIndex()],
    ...deeperPages.map((deeperPage): [string, string] => [
      deeperPage.file,
      renderDeeperPage(
        deeperPage,
        listScreenStates(inventory, deeperPage.screen),
        surfacesById,
      ),
    ]),
  ]);
}

/** The Deeper section's first page: what the pages are, and one link per screen. */
function renderDeeperIndex(): string {
  const pageLinks = deeperPages.map(
    (deeperPage) =>
      `- [${deeperPage.title}](./${deeperPage.file}): ${deeperPage.description}`,
  );
  return [
    "---",
    "title: Deeper",
    "description: Every control and text of every screen, one page per screen.",
    "---",
    "",
    "The guide's menu pages explain a screen as a whole. These pages go one level down: every button, menu item, switch, tab, field, filter, column, badge and shortcut, and every text a screen can show, each with what it does, what it changes or sends, where its text comes from, where it leads, the errors it can show, and the same action from the REST API, the CLI and MCP.",
    "",
    "The list of controls is read from the demo by a crawl, so a page always matches the screen it describes.",
    "",
    ...pageLinks,
    "",
  ].join("\n");
}
