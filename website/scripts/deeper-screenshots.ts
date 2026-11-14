/**
 * The Deeper pages' annotated screenshots (WS-10.2, WS-10.4): each screen in the light theme
 * with a numbered marker on every control in view, numbered as its page numbers the entries.
 * Run by `capture-screenshots.ts` with the other scenes, or alone with the scene name `deeper`.
 */
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import type { Locator, Page } from "@playwright/test";

import {
  listScreenStates,
  loadDeeperInventory,
} from "../lib/deeper/deeper-inventory";
import { deeperPages } from "../lib/deeper/deeper-pages";
import { toNamePattern } from "../lib/deeper/control-name-pattern";
import { numberDeeperEntries } from "../lib/deeper/number-deeper-entries";
import {
  splitControl,
  toDeeperImageFile,
} from "../lib/deeper/render-deeper-page";
import { deeperDirectory } from "../lib/deeper/render-deeper-pages";

/** Roles a reader clicks or reads as a label; texts and headings would bury the picture. */
const markedRoles = new Set([
  "button",
  "link",
  "tab",
  "menuitem",
  "switch",
  "checkbox",
  "radio",
  "combobox",
  "textbox",
  "searchbox",
  "spinbutton",
  "slider",
  "columnheader",
  "img",
]);

type MarkerBox = { entryNumber: number; x: number; y: number };

async function findFirstBoxInView(
  candidates: Locator[],
  viewportSize: { width: number; height: number },
) {
  for (const candidate of candidates) {
    const box = await candidate.boundingBox();
    const isInView =
      box !== null &&
      box.width > 0 &&
      box.y >= 0 &&
      box.x >= 0 &&
      box.y + 8 < viewportSize.height &&
      box.x + 8 < viewportSize.width;
    if (isInView) {
      return box;
    }
  }
  return null;
}

/**
 * A screen's own controls are looked for in its content first, since a name pattern with `…`
 * would also match the sidebar; the header's heading and guide link fall back to the page.
 */
async function findControlBox(
  page: Page,
  screen: string,
  role: string,
  name: string,
  viewportSize: { width: number; height: number },
) {
  const scopes =
    screen === "shell"
      ? [page.locator("body")]
      : [page.locator("#main-content"), page.locator("body")];
  for (const scope of scopes) {
    const candidates = await scope
      .getByRole(role as Parameters<Page["getByRole"]>[0], {
        name: toNamePattern(name),
      })
      .all();
    const box = await findFirstBoxInView(candidates, viewportSize);
    if (box !== null) {
      return box;
    }
  }
  return null;
}

async function drawMarkers(page: Page, markerBoxes: MarkerBox[]) {
  await page.evaluate((boxes) => {
    const layer = document.createElement("div");
    layer.dataset.deeperMarkers = "";
    layer.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:2147483647";
    for (const { entryNumber, x, y } of boxes) {
      const marker = document.createElement("span");
      marker.textContent = String(entryNumber);
      marker.style.cssText = [
        "position:absolute",
        `left:${Math.max(0, x - 9)}px`,
        `top:${Math.max(0, y - 9)}px`,
        "min-width:18px",
        "height:18px",
        "padding:0 4px",
        "box-sizing:border-box",
        "border-radius:9px",
        "background:#111827",
        "color:#ffffff",
        "outline:2px solid #ffffff",
        "font:600 11px/18px system-ui,sans-serif",
        "text-align:center",
      ].join(";");
      layer.append(marker);
    }
    document.body.append(layer);
  }, markerBoxes);
}

async function removeMarkers(page: Page) {
  await page.evaluate(() => {
    document.querySelector("[data-deeper-markers]")?.remove();
  });
}

/** Photographs each Deeper page's screen with its markers, into docs/wiki/deeper/images/. */
export async function captureDeeperScreenshots(
  page: Page,
  openScreen: (page: Page, screenPath: string) => Promise<void>,
) {
  const inventory = loadDeeperInventory();
  const viewportSize = page.viewportSize() ?? { width: 1280, height: 800 };
  for (const deeperPage of deeperPages) {
    await page.keyboard.press("Escape");
    await openScreen(
      page,
      deeperPage.screen === "shell" ? "/" : deeperPage.screen,
    );
    await page.waitForTimeout(1_000);
    const [firstState] = numberDeeperEntries(
      deeperPage,
      listScreenStates(inventory, deeperPage.screen),
    );
    const markerBoxes: MarkerBox[] = [];
    for (const { entryNumber, control } of firstState?.numberedEntries ?? []) {
      const { role, name } = splitControl(control);
      if (!markedRoles.has(role)) {
        continue;
      }
      const box = await findControlBox(
        page,
        deeperPage.screen,
        role,
        name,
        viewportSize,
      );
      if (box !== null) {
        markerBoxes.push({ entryNumber, x: box.x, y: box.y });
      }
    }
    await drawMarkers(page, markerBoxes);
    const imagePath = join(deeperDirectory, toDeeperImageFile(deeperPage.file));
    mkdirSync(dirname(imagePath), { recursive: true });
    await page.screenshot({
      path: imagePath,
      type: "jpeg",
      quality: 70,
      animations: "disabled",
    });
    await removeMarkers(page);
  }
}
