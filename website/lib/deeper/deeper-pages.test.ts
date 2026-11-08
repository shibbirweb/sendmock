import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { findDeeperProblems } from "./deeper-checks";
import { listInventoryScreens, loadDeeperInventory } from "./deeper-inventory";
import { deeperPages, pendingDeeperScreens } from "./deeper-pages";
import { indexOperationSurfaces } from "./deeper-surfaces";
import { toDeeperImageFile } from "./render-deeper-page";
import { deeperDirectory, renderDeeperPages } from "./render-deeper-pages";

const inventory = loadDeeperInventory();

describe("Deeper pages (WS-10)", () => {
  test("WS-10.3 every control and text of a written page's screen has an entry, and every entry names one", () => {
    expect(
      findDeeperProblems(deeperPages, inventory, indexOperationSurfaces()),
    ).toEqual([]);
  });

  test("WS-10.1 every screen of the inventory has a page or is still listed as pending", () => {
    const writtenScreens = deeperPages.map((deeperPage) => deeperPage.screen);
    const screensWithoutPage = listInventoryScreens(inventory).filter(
      (screen) => !writtenScreens.includes(screen),
    );

    expect(screensWithoutPage).toEqual(pendingDeeperScreens);
  });

  test("WS-10.2 every page has its annotated screenshot from bun run screenshots", () => {
    const pagesWithoutImage = deeperPages
      .map((deeperPage) => toDeeperImageFile(deeperPage.file))
      .filter((imageFile) => !existsSync(join(deeperDirectory, imageFile)));

    expect(pagesWithoutImage).toEqual([]);
  });

  test("WS-10.4 every page is a fresh render of its entries, the inventory and the API references", () => {
    for (const [pageFile, freshText] of renderDeeperPages()) {
      const pagePath = join(deeperDirectory, pageFile);
      expect(existsSync(pagePath), pageFile).toBe(true);
      expect(readFileSync(pagePath, "utf8"), pageFile).toBe(freshText);
    }
  });

  test("WS-10.4 no page has an unescaped { } or < outside code, which the MDX docs site would read as code", () => {
    const unsafeLines = [...renderDeeperPages()].flatMap(
      ([pageFile, pageText]) =>
        pageText
          .replace(/^---\n[\s\S]*?\n---\n/, "")
          .split("\n")
          .map((line) =>
            line.replace(/`[^`]*`/g, "").replace(/\]\([^)]*\)/g, "]"),
          )
          .filter((proseLine) =>
            /(^|[^\\])[{}<]/.test(proseLine.replace(/^> /, "")),
          )
          .map((proseLine) => `${pageFile}: ${proseLine}`),
    );

    expect(unsafeLines).toEqual([]);
  });
});
